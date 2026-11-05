#!/usr/bin/env python3
"""Kiểm tra API bằng thư viện chuẩn Python, không cần pip install.
Cách dùng: python scripts/smoke_api.py [http://localhost:8081]
"""
import json, sys, urllib.request, urllib.error
BASE = (sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8081').rstrip('/')

def api(path, method='GET', token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read())

if __name__ == '__main__':
    status, obj = api('/api/health')
    assert status == 200 and obj['status'] == 'UP', (status, obj)
    status, obj = api('/api/auth/login', 'POST', body={'email':'admin@gmail.com','password':'123456'})
    assert status == 200 and obj.get('token'), (status, obj)
    token = obj['token']
    for path in ('/api/auth/me', '/api/dashboard/statistics', '/api/interns', '/api/mentors', '/api/departments', '/api/tasks', '/api/reports', '/api/evaluations'):
        status, data = api(path, token=token)
        assert status == 200, (path,status,data)
        print('OK',path)
    status,_ = api('/api/auth/logout','POST',token=token)
    assert status == 200
    status,_ = api('/api/auth/me',token=token)
    assert status == 401
    print('PASS: Health, Login, 8 GET APIs, Logout, Session revocation')
