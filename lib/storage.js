function createMemoryStore() {
  var competitions = [];
  var messages = [];

  return {
    listCompetitions: function listCompetitions() {
      return Promise.resolve(competitions.slice());
    },
    putCompetition: function putCompetition(competition) {
      competitions = competitions.filter(function(item) {
        return item.id !== competition.id;
      });
      competitions.push(competition);
      return Promise.resolve(competition);
    },
    listMessages: function listMessages(options) {
      options = options || {};
      var filtered = messages.slice();
      if (options.channel) {
        filtered = filtered.filter(function(item) {
          return item.channel === options.channel;
        });
      }
      if (options.descending) {
        filtered = filtered.sort(function(a, b) {
          return b.timestamp - a.timestamp;
        });
      } else {
        filtered = filtered.sort(function(a, b) {
          return a.timestamp - b.timestamp;
        });
      }
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }
      return Promise.resolve(filtered);
    },
    sendMessage: function sendMessage(message) {
      messages.push(message);
      return Promise.resolve(message);
    },
  };
}

function createDynamoStore(options) {
  options = options || {};
  var tableName = options.messagesTable || 'messages';
  var region = options.region;
  var DynamoDBClient = require('@aws-sdk/client-dynamodb').DynamoDBClient;
  var DynamoDBDocumentClient = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient;
  var PutCommand = require('@aws-sdk/lib-dynamodb').PutCommand;
  var QueryCommand = require('@aws-sdk/lib-dynamodb').QueryCommand;

  var client = new DynamoDBClient({ region: region });
  var docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  function notImplemented() {
    var err = new Error('Competition storage not implemented for DynamoDB');
    err.statusCode = 501;
    return Promise.reject(err);
  }

  return {
    listCompetitions: notImplemented,
    putCompetition: notImplemented,
    listMessages: function listMessages(params) {
      params = params || {};
      if (!params.channel) {
        var err = new Error('Channel is required to list messages');
        err.statusCode = 400;
        return Promise.reject(err);
      }
      var limit = params.limit || undefined;
      var descending = !!params.descending;
      var command = new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: '#channel = :channel',
        ExpressionAttributeNames: { '#channel': 'channel' },
        ExpressionAttributeValues: { ':channel': params.channel },
        ScanIndexForward: !descending,
        Limit: limit,
      });
      return docClient.send(command).then(function(result) {
        return result.Items || [];
      });
    },
    sendMessage: function sendMessage(message) {
      var command = new PutCommand({
        TableName: tableName,
        Item: message,
      });
      return docClient.send(command).then(function() {
        return message;
      });
    },
  };
}

function createStore(options) {
  options = options || {};
  if (options.backend === 'dynamo') {
    return createDynamoStore(options);
  }
  return createMemoryStore();
}

module.exports = {
  createStore: createStore,
};
