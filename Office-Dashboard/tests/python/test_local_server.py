import hashlib
import hmac
import http.client
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'launcher'))
from server import LocalCommandServer


class LocalProofTests(unittest.TestCase):
    def setUp(self):
        self.key = 'test-api-key-' + 'a' * 48
        self.device = '11111111-1111-4111-8111-111111111111'
        self.origin = 'http://localhost:3000'
        self.server = LocalCommandServer(self.key, 0, self.device, (self.origin,))
        self.server.set_platform_callback(lambda ticket: {'success': True, 'state': 'BROWSER_LAUNCHED'})
        self.port = self.server.start()

    def tearDown(self):
        self.server.stop()

    def post(self, path, body, origin):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        connection.request('POST', path, body=json.dumps(body), headers={
            'Origin': origin, 'Content-Type': 'application/json',
        })
        response = connection.getresponse()
        data = json.loads(response.read())
        headers = dict(response.getheaders())
        connection.close()
        return response.status, data, headers

    def test_proof_is_device_bound_and_origin_checked(self):
        reference = '22222222-2222-4222-8222-222222222222'
        status, proof, headers = self.post('/platform-proof', {
            'purpose': 'grant', 'referenceId': reference,
        }, self.origin)
        self.assertEqual(status, 200)
        self.assertEqual(proof['deviceId'], self.device)
        self.assertEqual(headers['Access-Control-Allow-Origin'], self.origin)
        message = f"grant|{reference}|{self.device}|{proof['timestamp']}".encode()
        key_hash = hashlib.sha256(self.key.encode()).hexdigest().encode()
        expected = hmac.new(key_hash, message, hashlib.sha256).hexdigest()
        self.assertEqual(proof['signature'], expected)

        status, _, headers = self.post('/platform-proof', {
            'purpose': 'grant', 'referenceId': reference,
        }, 'https://evil.test')
        self.assertEqual(status, 403)
        self.assertNotIn('Access-Control-Allow-Origin', headers)

    def test_launch_rejects_wrong_origin_and_invalid_ticket(self):
        self.assertEqual(self.post('/launch-platform', {'ticket': 'x' * 40}, 'https://evil.test')[0], 403)
        self.assertEqual(self.post('/launch-platform', {'ticket': 'short'}, self.origin)[0], 400)
        self.assertEqual(self.post('/launch-platform', {'ticket': 'x' * 40}, self.origin)[0], 200)


if __name__ == '__main__':
    unittest.main()
