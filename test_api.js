const http = require('http');

const data = JSON.stringify({
  unclaimedBodyPage: {
    sections: []
  }
});

const options = {
  hostname: 'localhost',
  port: 5000, // Assuming backend is on 5000
  path: '/api/settings/admin',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    // We would need an auth token here...
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
