module.exports = function (http, api, ctx) {
    return function acpUser(userID, callback) {
      const form = {
        av: ctx.userID,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "FriendingCometFriendRequestConfirmMutation",
        variables: JSON.stringify({
          input: {
            attribution_id_v2: `FriendingCometFriendRequestsRoot.react,comet.friending.friendrequests,unexpected,${Date.now()},609381,2356318349,,;FriendingCometRoot.react,comet.friending,tap_tabbar,${Date.now()},496978,2356318349,,`,
            friend_requester_id: userID,
            friending_channel: "FRIENDS_HOME_MAIN",
            actor_id: ctx.globalOptions?.pageID || ctx.userID,
            client_mutation_id: Math.floor(Math.random() * 20).toString()
          },
          scale: 1,
          refresh_num: 0
        }),
        server_timestamps: true,
        doc_id: "26226851996930142"
      };
  
      http.post("https://www.facebook.com/api/graphql/", ctx.jar, form, null, null)
        .then((res) => {
          if (res.errors) {
            return callback({ error: res.errors });
          }
          return callback(res.data || { success: true });
        })
        .catch((err) => {
          return callback({ error: err.message || "Lỗi không xác định" });
        });
    };
  };
  