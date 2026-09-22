"""
Local HTTP server for receiving launch commands from dashboard.
Runs on localhost only and validates all requests.
"""

import http.server
import json
import socket
import threading
import logging
import hashlib
import hmac
import re
import time
from typing import Callable, Optional
from urllib.parse import urlparse, parse_qs

# Configure logging
logger = logging.getLogger(__name__)


class LocalCommandHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for local command server."""
    
    # These will be set by the server
    api_key: str = ""
    launch_callback: Optional[Callable] = None
    health_callback: Optional[Callable] = None
    platform_callback: Optional[Callable] = None
    device_id: str = ""
    allowed_origins: tuple[str, ...] = ()

    def do_OPTIONS(self):
        if urlparse(self.path).path not in ('/platform-proof', '/launch-platform') or not self._origin_allowed():
            self._send_error(403, 'Origin not approved')
            return
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '60')
        self.send_header('Vary', 'Origin')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/health':
            self._handle_health()
        else:
            self._send_error(404, "Not Found")
    
    def do_POST(self):
        """Handle POST requests."""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/platform-proof':
            self._handle_platform_proof()
        elif parsed_path.path == '/launch-platform':
            self._handle_launch_platform()
        elif parsed_path.path == '/launch-whatsapp':
            self._handle_launch_whatsapp()
        else:
            self._send_error(404, "Not Found")

    def _origin_allowed(self) -> bool:
        return self.headers.get('Origin', '') in self.allowed_origins

    def _platform_json(self) -> dict | None:
        if not self._origin_allowed():
            self._send_error(403, 'Origin not approved')
            return None
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            self._send_error(415, 'JSON required')
            return None
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 8192:
                raise ValueError('Invalid body length')
            data = json.loads(self.rfile.read(length).decode('utf-8'))
            if not isinstance(data, dict):
                raise ValueError('JSON object required')
            return data
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self._send_error(400, 'Invalid request')
            return None

    def _handle_platform_proof(self):
        data = self._platform_json()
        if data is None:
            return
        purpose = data.get('purpose')
        reference = data.get('referenceId')
        uuid = r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
        if purpose not in ('grant', 'confirm') or not isinstance(reference, str) or not re.fullmatch(uuid + (r':[1-9][0-9]*' if purpose == 'confirm' else ''), reference):
            self._send_error(400, 'Invalid proof scope')
            return
        timestamp = int(time.time() * 1000)
        message = f'{purpose}|{reference}|{self.device_id}|{timestamp}'.encode('utf-8')
        key_hash = hashlib.sha256(self.api_key.encode('utf-8')).hexdigest().encode('ascii')
        signature = hmac.new(key_hash, message, hashlib.sha256).hexdigest()
        self._send_json_response(200, {
            'deviceId': self.device_id, 'purpose': purpose, 'referenceId': reference,
            'timestamp': timestamp, 'signature': signature,
        })

    def _handle_launch_platform(self):
        data = self._platform_json()
        if data is None:
            return
        ticket = data.get('ticket')
        if not isinstance(ticket, str) or not 32 <= len(ticket) <= 4096:
            self._send_error(400, 'Invalid launch ticket')
            return
        if not self.platform_callback:
            self._send_error(503, 'Platform launcher not configured')
            return
        try:
            result = type(self).platform_callback(ticket)
            self._send_json_response(200 if result.get('success') else 502, result)
        except Exception:
            logger.exception('Platform launch failed')
            self._send_error(500, 'Platform launch failed')
    
    def _handle_health(self):
        """Handle health check request."""
        if self.headers.get('Origin') and not self._origin_allowed():
            self._send_error(403, 'Origin not approved')
            return
        if self.health_callback:
            result = type(self).health_callback()
            self._send_json_response(200, result)
        else:
            self._send_json_response(200, {"status": "ok", "service": "hair-rap-launcher"})
    
    def _handle_launch_whatsapp(self):
        """Handle WhatsApp launch request."""
        # Validate API key
        if not self._validate_api_key():
            self._send_error(401, "Unauthorized: Invalid or missing API key")
            return
        
        # Read request body
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 10240:  # 10KB max
                self._send_error(413, "Request too large")
                return
            
            body = self.rfile.read(content_length)
            request_data = json.loads(body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            self._send_error(400, f"Invalid JSON: {e}")
            return
        
        # Validate required fields
        required_fields = ['session_code', 'session_directory', 'session_id']
        for field in required_fields:
            if field not in request_data:
                self._send_error(400, f"Missing required field: {field}")
                return
        
        # Call launch callback
        if self.launch_callback:
            try:
                result = type(self).launch_callback(request_data)
                self._send_json_response(200, result)
            except Exception as e:
                logger.error(f"Launch callback error: {e}")
                self._send_error(500, f"Internal error: {e}")
        else:
            self._send_error(503, "Launch handler not configured")
    
    def _validate_api_key(self) -> bool:
        """Validate API key from request headers."""
        auth_header = self.headers.get('Authorization', '')
        
        if not auth_header:
            return False
        
        # Support Bearer token format
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            token = auth_header
        
        return token == self.api_key
    
    def _send_json_response(self, status_code: int, data: dict):
        """Send JSON response."""
        response = json.dumps(data)
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        if self._origin_allowed() and urlparse(self.path).path in ('/health', '/platform-proof', '/launch-platform'):
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response.encode('utf-8'))
    
    def _send_error(self, status_code: int, message: str):
        """Send error response."""
        self._send_json_response(status_code, {"success": False, "error": message})
    
    def log_message(self, format, *args):
        """Override to use logging instead of stderr."""
        logger.debug(f"{self.client_address[0]} - {format % args}")


class LocalCommandServer:
    """Local HTTP server for receiving commands from dashboard."""
    
    def __init__(self, api_key: str, port: int = 0, device_id: str = '', allowed_origins: tuple[str, ...] = ()):
        """
        Initialize local command server.
        
        Args:
            api_key: API key for authentication
            port: Port to listen on (0 = random available port)
        """
        self.api_key = api_key
        self.device_id = device_id
        self.allowed_origins = allowed_origins
        self.port = port
        self.server = None
        self.server_thread = None
        self.launch_callback = None
        self.health_callback = None
        self.platform_callback = None

    def set_platform_callback(self, callback: Callable):
        self.platform_callback = callback
    
    def set_launch_callback(self, callback: Callable):
        """Set callback for launch commands."""
        self.launch_callback = callback
    
    def set_health_callback(self, callback: Callable):
        """Set callback for health checks."""
        self.health_callback = callback
    
    def start(self) -> int:
        """
        Start the local server.
        
        Returns:
            Port number the server is listening on
        """
        # Configure handler
        LocalCommandHandler.api_key = self.api_key
        LocalCommandHandler.launch_callback = self.launch_callback
        LocalCommandHandler.health_callback = self.health_callback
        LocalCommandHandler.platform_callback = self.platform_callback
        LocalCommandHandler.device_id = self.device_id
        LocalCommandHandler.allowed_origins = self.allowed_origins
        
        # Create server bound to localhost only
        server_address = ('127.0.0.1', self.port)
        
        try:
            self.server = http.server.HTTPServer(server_address, LocalCommandHandler)
            self.port = self.server.server_address[1]
            
            # Start server in background thread
            self.server_thread = threading.Thread(
                target=self.server.serve_forever,
                daemon=True
            )
            self.server_thread.start()
            
            logger.info(f"Local command server started on port {self.port}")
            return self.port
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
            raise
    
    def stop(self):
        """Stop the local server."""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            logger.info("Local command server stopped")
    
    def get_port(self) -> int:
        """Get the port the server is listening on."""
        return self.port
    
    def is_running(self) -> bool:
        """Check if server is running."""
        return self.server is not None and self.server_thread is not None and self.server_thread.is_alive()
