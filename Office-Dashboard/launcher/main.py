"""
Main launcher application for Hair Rap.
Manages isolated WhatsApp Web browser sessions.
"""

import os
import sys
import time
import socket
import logging
import argparse
from datetime import datetime
from pathlib import Path

from config import load_config, save_config, update_config_value
from security import validate_launch_request, validate_session_directory
from browser import find_browser, launch_whatsapp_session
from platforms import launch_platform_profile
from api_client import DashboardClient
from server import LocalCommandServer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('launcher.log'),
    ]
)
logger = logging.getLogger(__name__)


class HairRapLauncher:
    """Main launcher application."""
    
    def __init__(self):
        """Initialize launcher."""
        self.config = load_config()
        self.client = DashboardClient(
            dashboard_url=self.config['dashboard_url'],
            api_key=self.config['api_key'],
            device_id=self.config['device_id'],
        )
        self.browser_name = None
        self.browser_path = None
        self.server = None
        self.running = False
    
    def initialize(self) -> bool:
        """
        Initialize launcher components.
        
        Returns:
            True if initialization successful, False otherwise
        """
        # Find browser
        try:
            self.browser_name, self.browser_path = find_browser()
            logger.info(f"Found browser: {self.browser_name} at {self.browser_path}")
        except FileNotFoundError as e:
            logger.error(f"Browser not found: {e}")
            return False
        
        # Ensure session base directory exists
        session_base = self.config['session_base_path']
        try:
            os.makedirs(session_base, exist_ok=True)
            logger.info(f"Session base directory: {session_base}")
        except OSError as e:
            logger.error(f"Could not create session directory: {e}")
            return False
        
        return True
    
    def register(self) -> bool:
        """
        Register device with dashboard.
        
        Returns:
            True if registration successful, False otherwise
        """
        # Check if already registered
        if self.config['device_id']:
            logger.info(f"Device already registered with ID: {self.config['device_id']}")
            self.client.device_id = self.config['device_id']
            return True
        
        # Get device info
        device_code = self.config['device_code']
        friendly_name = self.config['friendly_name']
        hostname = socket.gethostname()
        
        # Prompt for device code if not set
        if not device_code:
            device_code = input("Enter device code (e.g., PC-01): ").strip()
            if not device_code:
                logger.error("Device code is required")
                return False
            update_config_value('device_code', device_code)
        
        # Prompt for friendly name if not set
        if not friendly_name:
            friendly_name = input("Enter friendly name (e.g., Main Office Desktop): ").strip()
            if not friendly_name:
                friendly_name = hostname
            update_config_value('friendly_name', friendly_name)
        
        # Register with dashboard
        logger.info("Registering device with dashboard...")
        result = self.client.register(device_code, friendly_name, hostname)
        
        if result.get('success'):
            device_id = result.get('device_id')
            api_key = result.get('api_key')
            
            if device_id:
                self.config['device_id'] = device_id
                update_config_value('device_id', device_id)
                logger.info(f"Device registered with ID: {device_id}")
            
            if api_key:
                self.config['api_key'] = api_key
                update_config_value('api_key', api_key)
                self.client.api_key = api_key
                self.client.session.headers['Authorization'] = f'Bearer {api_key}'
                logger.info("API key received and saved")
            
            return True
        else:
            logger.error(f"Registration failed: {result.get('error', 'Unknown error')}")
            return False
    
    def start_server(self) -> bool:
        """
        Start local command server.
        
        Returns:
            True if server started successfully, False otherwise
        """
        try:
            self.server = LocalCommandServer(
                api_key=self.config['api_key'],
                port=self.config['local_server_port'],
                device_id=self.config['device_id'],
                allowed_origins=tuple(self.config.get('dashboard_origins', [])),
            )
            
            # Set callbacks
            self.server.set_launch_callback(self.handle_launch_command)
            self.server.set_health_callback(self.handle_health_check)
            self.server.set_platform_callback(self.handle_platform_command)
            
            # Start server
            port = self.server.start()
            
            # Update config with actual port
            self.config['local_server_port'] = port
            update_config_value('local_server_port', port)
            
            logger.info(f"Local server started on port {port}")
            return True
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
            return False
    
    def run(self):
        """Main launcher loop."""
        logger.info("Starting Hair Rap Launcher...")
        
        # Initialize
        if not self.initialize():
            logger.error("Initialization failed")
            return
        
        # Register
        if not self.register():
            logger.error("Registration failed")
            return
        
        # Start server
        if not self.start_server():
            logger.error("Failed to start server")
            return
        
        self.running = True
        logger.info("Launcher running. Press Ctrl+C to stop.")
        
        try:
            # Main loop: heartbeat + check for commands
            while self.running:
                # Send heartbeat
                self.send_heartbeat()
                
                # Check for pending commands from dashboard
                self.check_pending_commands()
                
                # Sleep until next heartbeat
                time.sleep(self.config['heartbeat_interval'])
        except KeyboardInterrupt:
            logger.info("Shutdown requested...")
        finally:
            self.shutdown()
    
    def send_heartbeat(self):
        """Send heartbeat to dashboard."""
        if not self.config['device_id']:
            return
        
        result = self.client.heartbeat()
        if result.get('success'):
            logger.debug("Heartbeat sent successfully")
            self.client.report_platform_capability()
        else:
            logger.warning(f"Heartbeat failed: {result.get('error')}")
    
    def check_pending_commands(self):
        """Check for pending commands from dashboard."""
        if not self.config['device_id']:
            return
        
        commands = self.client.get_pending_commands()
        for command in commands:
            logger.info(f"Processing command: {command.get('type')}")
            if command.get('type') == 'launch-whatsapp':
                self.handle_launch_command(command.get('data', {}))
    
    def handle_launch_command(self, request_data: dict) -> dict:
        """
        Handle a WhatsApp session launch request.
        
        Args:
            request_data: Launch request data
            
        Returns:
            Response dictionary
        """
        session_id = request_data.get('session_id', 'unknown')
        session_code = request_data.get('session_code', '')
        session_dir = request_data.get('session_directory', '')
        
        logger.info(f"Launch request: session_code={session_code}, session_dir={session_dir}")
        
        # Report launching status
        self.client.report_status(session_id, 'launching')
        
        # Validate request
        is_valid, error_message = validate_launch_request(request_data)
        if not is_valid:
            logger.error(f"Invalid launch request: {error_message}")
            self.client.confirm_whatsapp_launch(session_id, False, error_message)
            self.client.report_status(session_id, 'error', error_message)
            return {"success": False, "error": error_message}
        
        # Create session directory if needed
        try:
            os.makedirs(session_dir, exist_ok=True)
        except OSError as e:
            error_msg = f"Could not create session directory: {e}"
            logger.error(error_msg)
            self.client.confirm_whatsapp_launch(session_id, False, error_msg)
            self.client.report_status(session_id, 'error', error_msg)
            return {"success": False, "error": error_msg}

        # Launch browser
        target_url = request_data.get('target_url', 'https://web.whatsapp.com/')
        success = launch_whatsapp_session(session_dir, self.browser_path, target_url)

        if success:
            logger.info(f"WhatsApp session launched: {session_code}")
            self.client.confirm_whatsapp_launch(session_id, True)
            self.client.report_status(session_id, 'running')
            return {"success": True, "message": "WhatsApp session launched"}
        else:
            error_msg = "Failed to launch browser"
            logger.error(error_msg)
            self.client.confirm_whatsapp_launch(session_id, False, error_msg)
            self.client.report_status(session_id, 'error', error_msg)
            return {"success": False, "error": error_msg}

    def handle_platform_command(self, ticket: str) -> dict:
        """Consume the signed ticket server-side before touching a local profile."""
        try:
            command = self.client.consume_platform_ticket(ticket)
        except Exception:
            logger.warning('Platform ticket rejected or backend unavailable')
            return {"success": False, "errorCode": "TICKET_REJECTED"}
        operation_id = command.get('operationId')
        try:
            launch_platform_profile(command['profileKey'], command['targetUrl'], self.browser_path)
        except FileNotFoundError:
            error_code = 'BROWSER_MISSING'
        except ValueError:
            error_code = 'PROFILE_ERROR'
        except Exception:
            error_code = 'LAUNCH_ERROR'
        else:
            try:
                self.client.acknowledge_platform_launch(operation_id, True)
            except Exception:
                logger.warning('Browser opened but backend acknowledgement failed')
                return {"success": False, "errorCode": "ACK_FAILED", "operationId": operation_id}
            return {"success": True, "state": "BROWSER_LAUNCHED", "operationId": operation_id}
        try:
            self.client.acknowledge_platform_launch(operation_id, False, error_code)
        except Exception:
            logger.warning('Launch failure acknowledgement failed')
        return {"success": False, "errorCode": error_code, "operationId": operation_id}

    def handle_health_check(self) -> dict:
        """
        Handle health check request.
        
        Returns:
            Health status dictionary
        """
        return {
            "status": "ok",
            "service": "hair-rap-launcher",
            "device_id": self.config['device_id'],
            "browser": self.browser_name,
            "browser_path": self.browser_path,
            "server_port": self.config['local_server_port'],
            "timestamp": datetime.utcnow().isoformat() + 'Z',
        }
    
    def shutdown(self):
        """Shutdown launcher."""
        self.running = False
        if self.server:
            self.server.stop()
        logger.info("Launcher stopped")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Hair Rap Launcher')
    parser.add_argument('--config', help='Path to config file')
    parser.add_argument('--register', action='store_true', help='Register device')
    parser.add_argument('--daemon', action='store_true', help='Run as daemon')
    args = parser.parse_args()
    
    launcher = HairRapLauncher()
    
    if args.register:
        launcher.initialize()
        launcher.register()
    else:
        launcher.run()


if __name__ == '__main__':
    main()
