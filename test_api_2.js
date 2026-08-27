const http = require('http');

const data = JSON.stringify({
  unclaimedBodyPage: {
    sections: []
  }
});

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/v1/settings/admin',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
