window.evtSource = {};
const join = force => {
  force && evtSource.close();
  evtSource = new EventSource(
    `//${window.TGB_HOST}/events/${window.BRIDGE_TOKEN}`
  );
  evtSource.addEventListener(
    "event",
    evt => {
      const payload = JSON.parse(evt.data);
      const data = payload.data;
      switch (payload.type) {
        case "msg":
          {
            WAPI.sendMessage2(data.to, data.text);
          }
          break;
      }
    },
    false
  );
};
join();
const rejoin = () => join(true);

fetch(`//${window.TGB_HOST}/api/status`, {
  method: "POST",
  body: JSON.stringify("active"),
  headers: {
    "Content-Type": "application/json"
  },
  mode: "no-cors"
});
//window.rejoin();

const rejoiner = setInterval(() => {
  evtSource.readyState !== EventSource.OPEN
    ? [console.warn("No connection, rejoining..."), rejoin()]
    : console.debug("Connection ok :)");
}, 9999);

WAPI.waitNewMessages(false, data => {
  //console.log(data)
  data.forEach(message => {
    //send seen
    WAPI.sendSeen(message.from._serialized);

    if (message.isGroupMsg) {
      let queried = window.Store.Contact.get(message.chat.groupMetadata.owner);
      //console.log(0)
      if (queried) {
        o = JSON.parse(JSON.stringify(queried));
        //console.log(1)
        o.formattedName = queried.get("__x_formattedName");
        // console.log(2)
      }
      message._groupOwner = o || message.chat.groupMetadata.owner;
      //console.log(3)
      //console.log(message._groupOwner);
    }

    fetch(`//${window.TGB_HOST}/api/msg`, {
      method: "POST",
      body: JSON.stringify(message),
      headers: {
        "Content-Type": "application/json"
      },
      mode: "no-cors"
    })
      .then(res => res.text())
      .then(t => {
        if (!message.isGroupMsg) {
          // const m = "✓ Nachricht wurde weitergeleitet";
          // WAPI.sendMessage2(message.from._serialized,
          //     `✓ 𝘕𝘢𝘤𝘩𝘳𝘪𝘤𝘩𝘵 𝘸𝘶𝘳𝘥𝘦 𝘸𝘦𝘪𝘵𝘦𝘳𝘨𝘦𝘭𝘦𝘪𝘵𝘦𝘵. \nMelde mich später…);
        }
      });

    window.log(`Message from ${message.from.user} checking..`);
    if (intents.blocked.indexOf(message.from.user) >= 0) {
      window.log("number is blocked by BOT. no reply");
      return;
    }
    if (message.type == "chat") {
      //message.isGroupMsg to check if this is a group
      if (
        message.isGroupMsg == true &&
        intents.appconfig.isGroupReply == false
      ) {
        window.log(
          "Message received in group and group reply is off. so will not take any actions."
        );
        return;
      }
      var exactMatch = intents.bot.find(obj =>
        obj.exact.find(ex => ex == message.body.toLowerCase())
      );
      var response = "";
      if (exactMatch != undefined) {
        response = exactMatch.response;
        window.log(`Replying with ${exactMatch.response}`);
      } else {
        response = intents.noMatch;
        console.log("No exact match found");
      }
      var PartialMatch = intents.bot.find(obj =>
        obj.contains.find(ex => message.body.toLowerCase().search(ex) > -1)
      );
      if (PartialMatch != undefined) {
        response = PartialMatch.response;
        window.log(`Replying with ${PartialMatch.response}`);
      } else {
        console.log("No partial match found");
      }
      WAPI.sendSeen(message.from._serialized);
      WAPI.sendMessage2(message.from._serialized, response);
      console.log();
      if ((exactMatch || PartialMatch).file != undefined) {
        window
          .getFile((exactMatch || PartialMatch).file)
          .then(base64Data => {
            //console.log(file);
            WAPI.sendImage(
              base64Data,
              message.from._serialized,
              (exactMatch || PartialMatch).file
            );
          })
          .catch(error => {
            window.log("Error in sending file\n" + error);
          });
      }
    }
  });
});
WAPI.addOptions = function() {
  var suggestions = "";
  intents.smartreply.suggestions.map(item => {
    suggestions += `<button style="background-color: #eeeeee;
                                margin: 5px;
                                padding: 5px 10px;
                                font-size: inherit;
                                border-radius: 50px;" class="reply-options">${item}</button>`;
  });
  var div = document.createElement("DIV");
  div.style.height = "40px";
  div.style.textAlign = "center";
  div.style.zIndex = "5";
  div.innerHTML = suggestions;
  div.classList.add("grGJn");
  var mainDiv = document.querySelector("#main");
  var footer = document.querySelector("footer");
  footer.insertBefore(div, footer.firstChild);
  var suggestions = document.body.querySelectorAll(".reply-options");
  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    suggestion.addEventListener("click", event => {
      console.log(event.target.textContent);
      window
        .sendMessage(event.target.textContent)
        .then(text => console.log(text));
    });
  }
  mainDiv.children[mainDiv.children.length - 5].querySelector(
    "div > div div[tabindex]"
  ).scrollTop += 100;
};
