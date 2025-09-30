const path = require("path");
const fs = require("fs");
const utils = require("./constants.js");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

class Devices {
  constructor(options = {}) {
    const dataDir = process.cwd();
    const persistentDeviceFile = path.join(dataDir, "persistent-device.json");

    this.options = {
      persistentDeviceFile,
      persistentDevice: fs.existsSync(persistentDeviceFile),
      ...options
    };

    this.deviceCache = new Map();
    this.fixedDeviceProfile = this.loadPersistentDevice();
  }

  loadPersistentDevice() {
    try {
      if (!this.options.persistentDevice) return null;
      if (fs.existsSync(this.options.persistentDeviceFile)) {
        const raw = JSON.parse(fs.readFileSync(this.options.persistentDeviceFile, "utf8"));
        if (raw && raw.deviceId && raw.familyDeviceId) {
          return raw;
        }
      }
    } catch (e) {
      utils.error("Failed to load persistent device: " + e.message + " ⚠️");
    }
    return null;
  }

  savePersistentDevice(profile) {
    if (!this.options.persistentDevice) return;
    try {
      fs.writeFileSync(this.options.persistentDeviceFile, JSON.stringify(profile, null, 2), "utf8");
    } catch (e) {
      utils.error("Failed to save persistent device: " + e.message);
    }
  }

  getRandomDevice() {
    if (this.fixedDeviceProfile) return this.fixedDeviceProfile;

    const devicesList = [
      { model: "Pixel 6", build: "SP2A.220505.002", sdk: "30", release: "11" },
      { model: "Pixel 5", build: "RQ3A.210805.001.A1", sdk: "30", release: "11" },
      { model: "Samsung Galaxy S21", build: "G991USQU4AUDA", sdk: "30", release: "11" },
      { model: "OnePlus 9", build: "LE2115_11_C.48", sdk: "30", release: "11" },
      { model: "Xiaomi Mi 11", build: "RKQ1.200826.002", sdk: "30", release: "11" },
      { model: "Pixel 7", build: "TD1A.220804.031", sdk: "33", release: "13" },
      { model: "Samsung Galaxy S22", build: "S901USQU2AVB3", sdk: "32", release: "12" }
    ];

    const device = devicesList[Math.floor(Math.random() * devicesList.length)];
    const deviceId = this.generateConsistentDeviceId(device);

    const profile = {
      userAgent: `Dalvik/2.1.0 (Linux; U; Android ${device.release}; ${device.model} Build/${device.build})`,
      device,
      deviceId,
      familyDeviceId: uuidv4(),
      androidId: this.generateAndroidId()
    };

    if (this.options.persistentDevice) {
      this.fixedDeviceProfile = profile;
      this.savePersistentDevice(profile);
    }

    return profile;
  }

  generateConsistentDeviceId(device) {
    const key = `${device.model}_${device.build}`;
    if (this.deviceCache.has(key)) return this.deviceCache.get(key);

    const deviceId = uuidv4();
    this.deviceCache.set(key, deviceId);
    return deviceId;
  }

  generateAndroidId() {
    return crypto.randomBytes(8).toString("hex");
  }

  randomString(length = 10) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = chars.charAt(Math.floor(Math.random() * 26)); // ensure starts with letter
    for (let i = 1; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

class GoogleAuthenticator {
    constructor() {
        this._codeLength = 6;
    }

    getCode(secret, timeSlice = null) {
        if (timeSlice === null) {
            timeSlice = Math.floor(Date.now() / 1000 / 30);
        }

        const secretkey = this._base32Decode(secret);
        const time = Buffer.alloc(8);
        time.writeUInt32BE(timeSlice, 4);
        const hmac = crypto.createHmac('sha1', secretkey);
        hmac.update(time);

        const hash = hmac.digest();
        const offset = hash[hash.length - 1] & 0x0F;
        const hashpart = hash.slice(offset, offset + 4);

        let code = hashpart.readUInt32BE(0) & 0x7FFFFFFF;
        code %= Math.pow(10, this._codeLength);

        return code.toString().padStart(this._codeLength, '0');
    }

    _base32Decode(secret) {
        const base32chars = this._getBase32LookupTable();
        const base32charsFlipped = {};
        for (let i = 0; i < base32chars.length; i++) {
            base32charsFlipped[base32chars[i]] = i;
        }

        secret = secret.replace(/=+$/, '');
        const charCount = secret.length;
        const bits = [];
        let buffer = 0, bitsLength = 0;

        for (let i = 0; i < charCount; i++) {
            const value = base32charsFlipped[secret[i]];
            if (value === undefined) {
                throw new Error('Invalid base32 character');
            }

            buffer = (buffer << 5) | value;
            bitsLength += 5;

            if (bitsLength >= 8) {
                bits.push((buffer >> (bitsLength - 8)) & 0xFF);
                bitsLength -= 8;
            }
        }

        return Buffer.from(bits);
    }

    _getBase32LookupTable() {
        return [
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
            'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
            'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
            'Y', 'Z', '2', '3', '4', '5', '6', '7',
            '='
        ];
    }
}

const devices = new Devices();

module.exports = {
    GoogleAuthenticator,
    devices
}