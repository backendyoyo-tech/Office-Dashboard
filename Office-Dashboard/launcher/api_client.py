# """
# Dashboard API communication for Hair Rap Launcher.
# Handles all HTTP communication with the dashboard backend.
# """

# import requests
# import json
# import logging
# from typing import Optional

# # Configure logging
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)


# class DashboardClient:
#     """Client for communicating with Hair Rap Dashboard API."""
    
#     def __init__(self, dashboard_url: str, api_key: str, device_id: str = ""):
#         """
#         Initialize dashboard client.
        
#         Args:
#             dashboard_url: Base URL of dashboard API
#             api_key: API key for authentication
#             device_id: Device ID (set after registration)
#         """
#         self.dashboard_url = dashboard_url.rstrip('/')
#         self.api_key = api_key
#         self.device_id = device_id
#         self.session = requests.Session()
#         self.session.headers.update({
#             'Content-Type': 'application/json',
#             'Authorization': f'Bearer {api_key}' if api_key else '',
#         })

#     def report_platform_capability(self) -> dict:
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/platform-capability"
#         try:
#             response = self.session.post(endpoint, json={"launcherVersion": "2.0.0"}, timeout=15)
#             response.raise_for_status()
#             return response.json()
#         except requests.exceptions.RequestException:
#             return {"approved": False}

#     def consume_platform_ticket(self, ticket: str) -> dict:
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/platform-consume"
#         response = self.session.post(endpoint, json={"ticket": ticket}, timeout=15)
#         response.raise_for_status()
#         return response.json()

#     def acknowledge_platform_launch(self, operation_id: str, success: bool, error_code: str | None = None) -> dict:
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/platform-ack"
#         payload = {"operationId": operation_id, "result": "DELIVERED" if success else "FAILED"}
#         if error_code:
#             payload["errorCode"] = error_code
#         response = self.session.post(endpoint, json=payload, timeout=15)
#         response.raise_for_status()
#         return response.json()
    
#     def register(self, device_code: str, friendly_name: str, hostname: str) -> dict:
#         """
#         Register this device with the dashboard.
        
#         Args:
#             device_code: Device code (e.g., "PC-01")
#             friendly_name: Human-readable device name
#             hostname: Computer hostname
            
#         Returns:
#             API response dictionary
#         """
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/register"
#         payload = {
#             "deviceCode": device_code,
#             "friendlyName": friendly_name,
#             "hostname": hostname,
#             "platform": "windows",
#             "launcherVersion": "1.0.0",
#         }
#         try:
#             response = self.session.post(endpoint, json=payload, timeout=30)
#             # response.raise_for_status()
#             if not response.ok:
#                logger.error(
#                   f"Registration failed: HTTP {response.status_code} - {response.text}"
#    )
#             return {
#         "success": False,
#         "error": response.text,
#         "status": response.status_code,
#      }    
#             result = response.json()

#             if 'deviceId' in result:
#                 self.device_id = result['deviceId']
#                 logger.info(f"Device registered with ID: {self.device_id}")

#             return result

#         except requests.exceptions.RequestException as e:
#             logger.error(f"Registration failed: {e}")
#             return {"success": False, "error": str(e)}
    
#     def heartbeat(self) -> dict:
#         """
#         Send heartbeat to dashboard.
        
#         Returns:
#             API response dictionary
#         """
#         if not self.device_id:
#             return {"success": False, "error": "Device not registered"}
        
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/heartbeat"
#         payload = {
#             "device_id": self.device_id,
#             "timestamp": self._get_timestamp(),
#         }
        
#         try:
#             response = self.session.post(endpoint, json=payload, timeout=30)
#             response.raise_for_status()
#             return response.json()
#         except requests.exceptions.RequestException as e:
#             logger.error(f"Heartbeat failed: {e}")
#             return {"success": False, "error": str(e)}
    
#     def confirm_whatsapp_launch(self, session_id: str, success: bool, error: Optional[str] = None) -> dict:
#         """
#         Report WhatsApp session launch result.
        
#         Args:
#             session_id: Session ID
#             success: Whether launch was successful
#             error: Error message if failed
            
#         Returns:
#             API response dictionary
#         """
#         if not self.device_id:
#             return {"success": False, "error": "Device not registered"}
        
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/whatsapp-confirm"
#         payload = {
#             "device_id": self.device_id,
#             "session_id": session_id,
#             "success": success,
#             "timestamp": self._get_timestamp(),
#         }
        
#         if error:
#             payload["error"] = error
        
#         try:
#             response = self.session.post(endpoint, json=payload, timeout=30)
#             response.raise_for_status()
#             return response.json()
#         except requests.exceptions.RequestException as e:
#             logger.error(f"Launch confirmation failed: {e}")
#             return {"success": False, "error": str(e)}
    
#     def report_status(self, session_id: str, status: str, error: Optional[str] = None) -> dict:
#         """
#         Report session status change.
        
#         Args:
#             session_id: Session ID
#             status: New status (e.g., "launching", "running", "closed", "error")
#             error: Error message if applicable
            
#         Returns:
#             API response dictionary
#         """
#         if not self.device_id:
#             return {"success": False, "error": "Device not registered"}
        
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/whatsapp-status"
#         payload = {
#             "device_id": self.device_id,
#             "session_id": session_id,
#             "status": status,
#             "timestamp": self._get_timestamp(),
#         }
        
#         if error:
#             payload["error"] = error
        
#         try:
#             response = self.session.post(endpoint, json=payload, timeout=30)
#             response.raise_for_status()
#             return response.json()
#         except requests.exceptions.RequestException as e:
#             logger.error(f"Status report failed: {e}")
#             return {"success": False, "error": str(e)}
    
#     def get_pending_commands(self) -> list:
#         """
#         Get pending commands from dashboard.
        
#         Returns:
#             List of pending commands
#         """
#         if not self.device_id:
#             return []
        
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/whatsapp-launch"
#         params = {"device_id": self.device_id}
        
#         try:
#             response = self.session.get(endpoint, params=params, timeout=30)
#             response.raise_for_status()
#             return response.json().get('commands', [])
#         except requests.exceptions.RequestException as e:
#             logger.error(f"Failed to get commands: {e}")
#             return []
    
#     def report_local_port(self, port: int) -> dict:
#         """
#         Report local server port to dashboard.
        
#         Args:
#             port: Local server port
            
#         Returns:
#             API response dictionary
#         """
#         if not self.device_id:
#             return {"success": False, "error": "Device not registered"}
        
#         endpoint = f"{self.dashboard_url}/api/v1/launcher/port"
#         payload = {
#             "device_id": self.device_id,
#             "port": port,
#         }
        
#         try:
#             response = self.session.post(endpoint, json=payload, timeout=30)
#             response.raise_for_status()
#             return response.json()
#         except requests.exceptions.RequestException as e:
#             logger.error(f"Port report failed: {e}")
#             return {"success": False, "error": str(e)}
    
#     def _get_timestamp(self) -> str:
#         """Get current timestamp in ISO format."""
#         from datetime import datetime
#         return datetime.utcnow().isoformat() + 'Z'



"""
Dashboard API communication for Hair Rap Launcher.
Handles all HTTP communication with the dashboard backend.
"""

import logging
import requests
from typing import Optional


logger = logging.getLogger(__name__)


class DashboardClient:
    """Client for communicating with the Hair Rap Dashboard API."""

    def __init__(
        self,
        dashboard_url: str,
        api_key: str = "",
        device_id: str = "",
    ):
        self.dashboard_url = dashboard_url.rstrip("/")
        self.api_key = api_key or ""
        self.device_id = device_id or ""

        self.session = requests.Session()

        self._update_auth_header()

    def _update_auth_header(self):
        """Update Authorization header."""

        self.session.headers.update(
            {
                "Content-Type": "application/json",
                "Authorization": (
                    f"Bearer {self.api_key}"
                    if self.api_key
                    else ""
                ),
            }
        )

    def set_credentials(
        self,
        device_id: str,
        api_key: str,
    ):
        """Update authenticated launcher credentials."""

        self.device_id = device_id
        self.api_key = api_key

        self._update_auth_header()

    # ------------------------------------------------------------------
    # Automatic device pairing
    # ------------------------------------------------------------------

    def request_pairing(
        self,
        hostname: str,
        friendly_name: str,
        launcher_version: str,
    ) -> dict:
        """
        Create a new launcher pairing request.

        This endpoint does not require authentication.
        """

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/pair/request"
        )

        payload = {
            "hostname": hostname,
            "friendlyName": friendly_name,
            "launcherVersion": launcher_version,
        }

        try:
            response = self.session.post(
                endpoint,
                json=payload,
                timeout=30,
            )

            response.raise_for_status()

            result = response.json()

            return result

        except requests.exceptions.RequestException as e:
            logger.error(
                "Pairing request failed: %s",
                e,
            )

            return {
                "success": False,
                "error": str(e),
            }

    def get_pairing_status(
        self,
        pairing_id: str,
        pairing_secret: str,
    ) -> dict:
        """
        Poll pairing status.

        The pairing secret proves that this launcher owns
        the original pairing request.
        """

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/pair/status"
        )

        payload = {
            "pairingId": pairing_id,
            "pairingSecret": pairing_secret,
        }

        try:
            response = self.session.post(
                endpoint,
                json=payload,
                timeout=30,
            )

            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(
                "Pairing status request failed: %s",
                e,
            )

            return {
                "success": False,
                "error": str(e),
            }

    # ------------------------------------------------------------------
    # Existing launcher registration
    # ------------------------------------------------------------------

    def register(
        self,
        device_code: str,
        friendly_name: str,
        hostname: str,
    ) -> dict:
        """
        Existing manual registration flow.

        Kept for backward compatibility.
        """

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/register"
        )

        payload = {
            "deviceCode": device_code,
            "friendlyName": friendly_name,
            "hostname": hostname,
            "platform": "windows",
            "launcherVersion": "1.0.0",
        }

        try:
            response = self.session.post(
                endpoint,
                json=payload,
                timeout=30,
            )

            if not response.ok:
                logger.error(
                    "Registration failed: HTTP %s - %s",
                    response.status_code,
                    response.text,
                )

                return {
                    "success": False,
                    "error": response.text,
                    "status": response.status_code,
                }

            result = response.json()

            if "deviceId" in result:
                self.device_id = result["deviceId"]

            return result

        except requests.exceptions.RequestException as e:
            logger.error(
                "Registration failed: %s",
                e,
            )

            return {
                "success": False,
                "error": str(e),
            }

    # ------------------------------------------------------------------
    # Platform launcher
    # ------------------------------------------------------------------

    def report_platform_capability(self) -> dict:
        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/platform-capability"
        )

        try:
            response = self.session.post(
                endpoint,
                json={
                    "launcherVersion": "2.0.0"
                },
                timeout=15,
            )

            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException:
            return {
                "approved": False
            }

    def consume_platform_ticket(
        self,
        ticket: str,
    ) -> dict:
        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/platform-consume"
        )

        response = self.session.post(
            endpoint,
            json={
                "ticket": ticket
            },
            timeout=15,
        )

        response.raise_for_status()

        return response.json()

    def acknowledge_platform_launch(
        self,
        operation_id: str,
        success: bool,
        error_code: Optional[str] = None,
    ) -> dict:

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/platform-ack"
        )

        payload = {
            "operationId": operation_id,
            "result": (
                "DELIVERED"
                if success
                else "FAILED"
            ),
        }

        if error_code:
            payload["errorCode"] = error_code

        response = self.session.post(
            endpoint,
            json=payload,
            timeout=15,
        )

        response.raise_for_status()

        return response.json()

    # ------------------------------------------------------------------
    # Heartbeat
    # ------------------------------------------------------------------

    def heartbeat(self) -> dict:

        if not self.device_id:
            return {
                "success": False,
                "error": "Device not registered",
            }

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/heartbeat"
        )

        payload = {
            "device_id": self.device_id,
            "timestamp": self._get_timestamp(),
        }

        try:
            response = self.session.post(
                endpoint,
                json=payload,
                timeout=30,
            )

            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(
                "Heartbeat failed: %s",
                e,
            )

            return {
                "success": False,
                "error": str(e),
            }

    # ------------------------------------------------------------------
    # WhatsApp
    # ------------------------------------------------------------------

    def confirm_whatsapp_launch(
        self,
        session_id: str,
        success: bool,
        error: Optional[str] = None,
    ) -> dict:

        if not self.device_id:
            return {
                "success": False,
                "error": "Device not registered",
            }

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/whatsapp-confirm"
        )

        payload = {
            "device_id": self.device_id,
            "session_id": session_id,
            "success": success,
            "timestamp": self._get_timestamp(),
        }

        if error:
            payload["error"] = error

        try:
            response = self.session.post(
                endpoint,
                json=payload,
                timeout=30,
            )

            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(
                "Launch confirmation failed: %s",
                e,
            )

            return {
                "success": False,
                "error": str(e),
            }

    def report_status(
        self,
        session_id: str,
        status: str,
        error: Optional[str] = None,
    ) -> dict:

        if not self.device_id:
            return {
                "success": False,
                "error": "Device not registered",
            }

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/whatsapp-status"
        )

        payload = {
            "device_id": self.device_id,
            "session_id": session_id,
            "status": status,
            "timestamp": self._get_timestamp(),
        }

        if error:
            payload["error"] = error

        try:
            response = self.session.post(
                endpoint,
                json=payload,
                timeout=30,
            )

            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(
                "Status report failed: %s",
                e,
            )

            return {
                "success": False,
                "error": str(e),
            }

    def get_pending_commands(self) -> list:

        if not self.device_id:
            return []

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/whatsapp-launch"
        )

        params = {
            "device_id": self.device_id
        }

        try:
            response = self.session.get(
                endpoint,
                params=params,
                timeout=30,
            )

            response.raise_for_status()

            return response.json().get(
                "commands",
                [],
            )

        except requests.exceptions.RequestException as e:
            logger.error(
                "Failed to get commands: %s",
                e,
            )

            return []

    def report_local_port(
        self,
        port: int,
    ) -> dict:

        if not self.device_id:
            return {
                "success": False,
                "error": "Device not registered",
            }

        endpoint = (
            f"{self.dashboard_url}"
            "/api/v1/launcher/port"
        )

        payload = {
            "device_id": self.device_id,
            "port": port,
        }

        try:
            response = self.session.post(
                endpoint,
                json=payload,
                timeout=30,
            )

            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(
                "Port report failed: %s",
                e,
            )

            return {
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def _get_timestamp() -> str:
        from datetime import datetime

        return datetime.utcnow().isoformat() + "Z"

