var os = require('os');
var fs = require('fs');
var path = require('path');
var _get = require('lodash.get');
var _map = require('lodash.map');
var request = require('request');
var async = require('async');

var DATA_URL = 'http://ffbinaries.com/';
var DEFAULT_DESTINATION = __dirname + '/bin';
var DATA_CACHE;

function ensureDirSync (dir) {
  try {
    fs.accessSync(dir);
  } catch (e) {
    fs.mkdirSync(dir);
  }
}

ensureDirSync(DEFAULT_DESTINATION);

/**
 * Detects the platform of the machine the script is executed on
 */
function detectPlatform () {
  var type = os.type();
  var arch = os.arch();

  // windows-32, windows-64, linux-32, linux-64, linux-armhf, linux-armel, osx-64

  if (type === 'Darwin') {
    return 'osx-64';
  }

  if (type === 'Windows_NT') {
    return arch == 'x64' ? 'windows-64' : 'windows-32';
  }

  if (type === 'Linux') {
    if (arch === 'arm' || arch === 'arm64') {
      return 'linux-armel';
    }
    return arch == 'x64' ? 'linux-64' : 'linux-32';
  }

  return;
}

/**
 * Gets full data set from ffbinaries.com
 */
function getData (callback) {
  if (DATA_CACHE) {
    return callback(null, DATA_CACHE);
  }

  request({url: DATA_URL}, function (err, response, body) {
    try {
      var parsed = JSON.parse(body.toString());
      DATA_CACHE = parsed;
      return callback(null, parsed);
    } catch (e) {
      console.log(e);
      return process.exit(1);
      // return callback(e);
    }
  });
}

/**
 * Download file(s) and save them in the specified directory
 */
function download (urls, destination, callback) {
  if (typeof urls === 'object') {
    urls = _map(urls, function (v) {return v;})
  } else if (typeof urls === 'string') {
    urls = [urls];
  }

  async.each(urls, function (url, cb) {
    var filename = url.split('/').pop();
    var runningTotal = 0;
    var totalFilesize;

    var interval = setInterval(function () {
      if (totalFilesize && runningTotal == totalFilesize) {
        return clearInterval(interval);
      }
      console.log(filename + ': Received ' + Math.floor(runningTotal/1024*100)/100 + 'KB');
    }, 2000);

    try {
      fs.accessSync(destination + '/' + filename);
      console.log('File "' + filename + '" already downloaded.');
      clearInterval(interval);
    } catch (e) {
      console.log('Downloading', filename, 'to', destination);
      request({url: url}, function (err, response, body) {
        totalFilesize = response.headers['content-length'];
        console.log('Data received. Total filesize: ', Math.floor(totalFilesize/1024*100)/100 + 'KB');

        fs.writeFileSync(destination + '/' + filename, body);
        return cb(err, body);
      })
      .on('data', function (data) {
        runningTotal += data.length;
      });
    }

  }, function () {
    console.log('All files downloaded.');
    return callback();
  })

}

/**
 * Gets binary - specify the platform and destination
 * It will get the data from ffbinaries, pick the correct file
 * and save it to the specified directory
 */
function getBinary (platform, destination, callback) {
  if (!callback) {
    if (!destination && typeof platform === 'function') {
      callback = platform;
      platform = null;
    }
    if (typeof destination === 'function') {
      callback = destination;
      destination = null;
    }
  }

  platform = platform || detectPlatform();
  destination = path.resolve(destination) || (DEFAULT_DESTINATION + '/' + platform);

  ensureDirSync(destination);

  getData(function (err, data) {
    var binaryURL = _get(data, 'bin.' + platform);
    if (!binaryURL) {
      return console.log('No binaryURL!');
    }

    download(binaryURL, destination, callback);
  });
}

module.exports = {
  get: getBinary,
  getData: getData,
  detectPlatform: detectPlatform
};
