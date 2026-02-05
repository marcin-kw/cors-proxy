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
    listMessages: function listMessages() {
      return Promise.resolve(messages.slice());
    },
    sendMessage: function sendMessage(message) {
      messages.push(message);
      return Promise.resolve(message);
    },
  };
}

function createDynamoStub() {
  function notImplemented() {
    var err = new Error('DynamoDB backend not implemented yet');
    err.statusCode = 501;
    return Promise.reject(err);
  }

  return {
    listCompetitions: notImplemented,
    putCompetition: notImplemented,
    listMessages: notImplemented,
    sendMessage: notImplemented,
  };
}

function createStore(options) {
  options = options || {};
  if (options.backend === 'dynamo') {
    return createDynamoStub();
  }
  return createMemoryStore();
}

module.exports = {
  createStore: createStore,
};
