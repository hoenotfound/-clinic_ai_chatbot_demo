const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function runWithConversationContext(context, callback) {
  return storage.run(context || {}, callback);
}

function currentConversationContext() {
  return storage.getStore() || null;
}

module.exports = {
  runWithConversationContext,
  currentConversationContext,
};
