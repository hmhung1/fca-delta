"use strict";

const utils = require('../../utils');
const axios = require("axios");
const path = require('path');
const fs = require('fs');
const qs = require("querystring");
const { v4: uuidv4 } = require("uuid");
const { GoogleAuthenticator, devices } = require("./../../utils/loginSupport.js");
const ga = new GoogleAuthenticator();
let mainPromise = null;

/**
 * The main login helper function, orchestrating the login process.
 *
 * @param {object} credentials User credentials or appState.
 * @param {object} globalOptions Global options for the API.
 * @param {function} callback The final callback function.
 * @param {function} setOptionsFunc Reference to the setOptions function from models.
 * @param {function} buildAPIFunc Reference to the buildAPI function from models.
 * @param {object} initialApi The initial API object to extend.
 * @param {function} fbLinkFunc A function to generate Facebook links.
 * @param {string} errorRetrievingMsg The error message for retrieving user ID.
 * @returns {Promise<void>}
 */

global.bypassAutoBehavior = async function (resp, jar, appstate, ID, globalOptions) {
  try {
    const appstateCUser = (appstate.find(i => i.key == 'c_user') || appstate.find(i => i.key == 'i_user'));
    const UID = ID || (appstateCUser && appstateCUser.value);
    const FormBypass = {
      av: UID,
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "FBScrapingWarningMutation",
      variables: JSON.stringify({}),
      server_timestamps: true,
      doc_id: 6339492849481770
    };
    const logSuspect = () => {
      utils.log(`Suspect automatic behavior on account ${UID}.`);
    };
    if (!resp) {
      resp = await utils.get(fbLinkFunc(), jar, null, globalOptions);
    }
    if (resp) {
      if (resp.request && resp.request.uri && resp.request.uri.href.includes("https://www.facebook.com/")) {
        if (resp.body.includes('FBScrapingWarningCometApp')) {
          const fb_dtsg = utils.getFrom(resp.body, '["DTSGInitData",[],{"token":"', '","');
          const jazoest = utils.getFrom(resp.body, 'jazoest=', '",');
          const lsd = utils.getFrom(resp.body, "[\"LSD\",[],{\"token\":\"", "\"}");
          return utils.post("https://www.facebook.com/api/graphql/", jar, {
            ...FormBypass,
            fb_dtsg,
            jazoest,
            lsd
          }, globalOptions).then(utils.saveCookies(jar)).then(res => {
            logSuspect();
            return res;
          });
        } else {
          return resp;
        }
      } else {
        return resp;
      }
    }
  } catch (e) {
    utils.error("error" + e, 'error');
  }
}

async function loginHelper(
  credentials,
  globalOptions,
  callback,
  setOptionsFunc,
  buildAPIFunc,
  initialApi,
  fbLinkFunc,
  errorRetrievingMsg
) {
  let ctx = null;
  let defaultFuncs = null;
  let api = initialApi;

  try {
    const jar = utils.getJar();
    utils.log("Logging in...");

    const appState = credentials.appState;

    if (appState) {
      let cookieStrings = [];
      if (Array.isArray(appState)) {
        cookieStrings = appState.map(c => [c.name || c.key, c.value].join('='));
      } else if (typeof appState === 'string') {
        cookieStrings = appState.split(';').map(s => s.trim()).filter(Boolean);
      } else {
        throw utils.error("Invalid appState format. Please provide an array of cookie objects or a cookie string.");
      }

      cookieStrings.forEach(cookieString => {
        const domain = ".facebook.com";
        const expires = new Date().getTime() + 1000 * 60 * 60 * 24 * 365;
        const str = `${cookieString}; expires=${expires}; domain=${domain}; path=/;`;
        jar.setCookie(str, `https://${domain}`);
      });
    } else if (credentials.email && credentials.password) {
      const androidDevice = devices.getRandomDevice();
      const machineId = devices.randomString(24);

      const url = "https://api.facebook.com/method/auth.login";
      const params = {
        adid: uuidv4(),
        access_token: "350685531728|62f8ce9f74b12f84c123cc23437a4a32",
        format: "json",
        device_id: androidDevice.deviceId,
        family_device_id: androidDevice.familyDeviceId,
        sdk_version: 2,
        email: credentials.email,
        locale: "en_US",
        client_country_code: 'US',
        credentials_type: 'device_based_login_password',
        machine_id: machineId,
        password: credentials.password,
        generate_session_cookies: 1,
        sig: "c1c640010993db92e5afd11634ced864",
        advertiser_id: uuidv4(),
        device_platform: 'android',
        app_version: '531.0.0.47.70',
        network_type: 'WIFI'
      };
      try {
        let resp = await axios.get(`${url}?${qs.stringify(params)}`);
        if (resp?.data?.error_code === 401) {
          throw new Error("Invalid email or password.");
        }
        if (resp?.data?.error_code === 405) {
          throw new Error("Account checkpointed. Please login to your account via browser and resolve the checkpoint.");
        }
        if (resp?.data?.error_code === 406) {
          if (credentials.twoFactor) {
            const otp = ga.getCode(credentials.twoFactor.replace(/\s+/g, ''));
            utils.log(`2FA code generated: ${otp}`);
            const errorData = JSON.parse(resp.data.error_data);
            const twoFactorForm = {
              ...params,
              twofactor_code: otp,
              encrypted_msisdn: "",
              userid: errorData.uid,
              machine_id: errorData.machine_id || machineId,
              first_factor: errorData.login_first_factor,
              credentials_type: "two_factor"
            };

            utils.log("Verifying 2FA code...");
            resp = await axios.get(`${url}?${qs.stringify(twoFactorForm)}`);
            if (resp.data["confirmed"] === true) {
              utils.log("2FA verification successful");
            }
          } else {
            throw new Error("Account has 2FA enabled, but no twoFactor secret was provided in credentials.");
          }
        }
        let cstrs = resp.data["session_cookies"].map(c => `${c.name}=${c.value}`);
        cstrs.forEach(cstr => {
          const domain = ".facebook.com";
          const expires = new Date().getTime() + 1000 * 60 * 60 * 24 * 365;
          const str = `${cstr}; expires=${expires}; domain=${domain}; path=/;`;
          jar.setCookie(str, `https://${domain}`);
        });
      } catch (e) {
        console.log(e);
        throw new Error("Invaid email or password.");
      }
    } else {
     throw new Error("No cookie or credentials found. Please provide cookies or credentials.");
    }

    if (!api) {
      api = {
        setOptions: setOptionsFunc.bind(null, globalOptions),
        getAppState() {
          const appState = utils.getAppState(jar);
          if (!Array.isArray(appState)) return [];
          const uniqueAppState = appState.filter(
            (item, index, self) => self.findIndex((t) => t.key === item.key) === index
          );
          return uniqueAppState.length > 0 ? uniqueAppState : appState;
        }
      };
    }

    mainPromise = utils
      .get(fbLinkFunc(), jar, null, globalOptions, { noRef: true })
      .then(utils.saveCookies(jar));

    const extractNetData = (html) => {
      const allScriptsData = [];
      const scriptRegex = /<script type="application\/json"[^>]*>(.*?)<\/script>/g;
      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        try {
          allScriptsData.push(JSON.parse(match[1]));
        } catch (e) {
          utils.error(`Failed to parse a JSON blob from HTML`, e.message);
        }
      }
      return allScriptsData;
    };

    mainPromise = mainPromise
      .then((res) => global.bypassAutoBehavior(res, jar, api.getAppState()))
      .then(async () => {
        const resp = await utils.get(fbLinkFunc(), jar, null, globalOptions);
        const netData = extractNetData(resp.body);
        const [newCtx, newDefaultFuncs] = await buildAPIFunc(
          resp.body,
          jar,
          netData,
          globalOptions,
          fbLinkFunc,
          errorRetrievingMsg
        );
        ctx = newCtx;
        defaultFuncs = newDefaultFuncs;
        api.message = new Map();
        api.timestamp = {};

        /**
         * Loads API modules from the deltas/apis directory.
         *
         * @returns {void}
         */
        const loadApiModules = () => {
          // CORRECTED PATH: From src/core/models/ to src/deltas/apis
          const apiPath = path.join(__dirname, '..', '..', 'deltas', 'apis');
          const apiFolders = fs
            .readdirSync(apiPath)
            .filter(name => fs.lstatSync(path.join(apiPath, name)).isDirectory());

          apiFolders.forEach(folder => {
            const modulePath = path.join(apiPath, folder);
            fs.readdirSync(modulePath)
              .filter(file => file.endsWith('.js'))
              .forEach(file => {
                const moduleName = path.basename(file, '.js');
                const fullPath = path.join(modulePath, file);
                try {
                  api[moduleName] = require(fullPath)(defaultFuncs, api, ctx);
                } catch (e) {
                  utils.error(`Failed to load module ${moduleName} from ${folder}:`, e);
                }
              });
          });
          const listenPath = path.join(__dirname, '..', '..', 'deltas', 'apis', 'mqtt', 'listenMqtt.js');
          const realtimePath = path.join(__dirname, '..', '..', 'deltas', 'apis', 'mqtt', 'realtime.js');

          if (fs.existsSync(realtimePath)) {
            api['realtime'] = require(realtimePath)(defaultFuncs, api, ctx);
          }
          if (fs.existsSync(listenPath)) {
            api['listenMqtt'] = require(listenPath)(defaultFuncs, api, ctx);
          }
        };

        api.postFormData = function (url, body) {
          return defaultFuncs.postFormData(url, ctx.jar, body);
        };
        api.getCurrentUserID = () => ctx.userID;
        api.getOptions = (key) => (key ? globalOptions[key] : globalOptions);
        loadApiModules();
        api.ctx = ctx;
        api.defaultFuncs = defaultFuncs;
        api.globalOptions = globalOptions;
        const { name: botName = "Facebook User", uid = ctx.userID } = await api.getBotInitialData();
        utils.log(`Hello, ${botName} (${uid})`);
        return callback(null, api)
      })
      .catch(error => {
        utils.error(error.error || error);
        return callback(error);
      });
  } catch (error) {
    utils.error(error.error || error);
    return callback(error);
  }
}

module.exports = loginHelper;
