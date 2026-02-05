var express = require('express');

// Listen on a specific host via the HOST environment variable
var host = process.env.HOST || '0.0.0.0';
// Listen on a specific port via the PORT environment variable
var port = process.env.PORT || 8080;

// Grab the blacklist from the command-line so that we can update the blacklist without deploying
// again. CORS Anywhere is open by design, and this blacklist is not used, except for countering
// immediate abuse (e.g. denial of service). If you want to block all origins except for some,
// use originWhitelist instead.
var originBlacklist = parseEnvList(process.env.CORSANYWHERE_BLACKLIST);
var originWhitelist = parseEnvList(process.env.CORSANYWHERE_WHITELIST);
function parseEnvList(env) {
  if (!env) {
    return [];
  }
  return env.split(',');
}

// Set up rate-limiting to avoid abuse of the public CORS Anywhere server.
var checkRateLimit = require('./lib/rate-limit')(process.env.CORSANYWHERE_RATELIMIT);

var cors_proxy = require('./lib/cors-anywhere');
var storage = require('./lib/storage');
var corsHandler = cors_proxy.createRequestHandler({
  originBlacklist: originBlacklist,
  originWhitelist: originWhitelist,
  requireHeader: ['origin', 'x-requested-with'],
  checkRateLimit: checkRateLimit,
  removeHeaders: [
    'cookie',
    'cookie2',
    // Strip Heroku-specific headers
    'x-request-start',
    'x-request-id',
    'via',
    'connect-time',
    'total-route-time',
    // Other Heroku added debug headers
    // 'x-forwarded-for',
    // 'x-forwarded-proto',
    // 'x-forwarded-port',
  ],
  redirectSameOrigin: true,
  httpProxyOptions: {
    // Do not add X-Forwarded-For, etc. headers, because Heroku already adds it.
    xfwd: false,
  },
});

var app = express();
app.use(express.json({ limit: '1mb' }));

var store = storage.createStore({
  backend: process.env.STORAGE_BACKEND,
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
  messagesTable: process.env.MESSAGES_TABLE,
});

app.get('/api/list-competitions', function(req, res) {
  Promise.resolve()
    .then(function() {
      return store.listCompetitions();
    })
    .then(function(competitions) {
      res.json({ ok: true, competitions: competitions });
    })
    .catch(function(err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Server error' });
    });
});

app.put('/api/put-competition', function(req, res) {
  var competition = req.body || {};
  if (!competition || typeof competition !== 'object') {
    res.status(400).json({ ok: false, error: 'Invalid competition payload' });
    return;
  }
  if (!competition.id) {
    competition.id = 'comp_' + Date.now();
  }
  competition.updatedAt = new Date().toISOString();
  Promise.resolve()
    .then(function() {
      return store.putCompetition(competition);
    })
    .then(function(saved) {
      res.json({ ok: true, competition: saved });
    })
    .catch(function(err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Server error' });
    });
});

app.post('/api/send-message', function(req, res) {
  var message = req.body || {};
  if (!message || typeof message !== 'object') {
    res.status(400).json({ ok: false, error: 'Invalid message payload' });
    return;
  }
  if (!message.channel || typeof message.channel !== 'string') {
    res.status(400).json({ ok: false, error: 'Message channel is required' });
    return;
  }
  if (!message.id) {
    message.id = 'msg_' + Date.now();
  }
  if (typeof message.timestamp !== 'number') {
    message.timestamp = Date.now();
  }
  message.createdAt = new Date(message.timestamp).toISOString();
  Promise.resolve()
    .then(function() {
      return store.sendMessage(message);
    })
    .then(function(saved) {
      res.json({ ok: true, message: saved });
    })
    .catch(function(err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Server error' });
    });
});

app.get('/api/list-messages', function(req, res) {
  var limit = Number(req.query.limit);
  if (!Number.isFinite(limit) || limit <= 0) {
    limit = null;
  }
  var descending = String(req.query.desc || '').toLowerCase() === 'true';
  var channel = req.query.channel;
  Promise.resolve()
    .then(function() {
      return store.listMessages({
        channel: channel,
        limit: limit || undefined,
        descending: descending,
      });
    })
    .then(function(messages) {
      res.json({ ok: true, messages: messages });
    })
    .catch(function(err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Server error' });
    });
});

app.use('/cors-proxy', corsHandler);

app.get('/health', function(req, res) {
  res.json({ ok: true });
});

app.listen(port, host, function() {
  console.log('Running API server on ' + host + ':' + port);
});
