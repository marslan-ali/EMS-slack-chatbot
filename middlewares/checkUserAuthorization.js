const { authorizedSlackIds } = require("../constants");

const checkUserAuthorization = async ({ event, client, next }) => {
  console.log(event);
  if (!authorizedSlackIds.includes(event.user)) {
    const text = `<@${event.user}> Sorry, you are not authorized to use this chatbot.`;

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text,
    });
    return;
  }

  await next();
};

module.exports = {
  checkUserAuthorization,
};
