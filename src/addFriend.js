"use strict";

module.exports = function (defaultFuncs, api, ctx) {
  return function addFriend(senderID, callback) {
    /*if (!ctx.mqttClient) {
      throw new Error("Not connected to MQTT");
    }*/
      const form = {
        av: ctx.userID,
        fb_api_req_friendly_name: "FriendingCometFriendRequestSendMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "9389629441119288",
        variables: JSON.stringify({
          input: {
            attribution_id_v2:
              "ProfileCometTimelineListViewRoot.react,comet.profile.timeline.list,via_cold_start,1742122719243,227985,190055527696468,,",
            is_tracking_encrypted: true,
            friending_channel: "PROFILE_BUTTON",
            friend_requestee_ids: senderID,
            tracking: null,
            actor_id: ctx.userID,
            client_mutation_id: "1",
          },
          scale: 1,
        }),
      };

    api.httpPost("https://www.facebook.com/api/graphql/", form, (err, data) => {
      if (err) {
        if (typeof callback === "function") {
          callback(err);
        }
      } else {
        if (typeof callback === "function") {
          callback(null, data);
        }
      }
    });
  };
};
