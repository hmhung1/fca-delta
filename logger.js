const chalk = require('chalk');
const gradient = require('gradient-string');

module.exports = (data, option) => {
  let coloredData = '';

  switch (option) {
    case 'warn':
      coloredData = gradient('#3aed34', '#c2ed34').multiline('[ Delta Warn ] > ' + data);
      console.log(chalk.bold(coloredData));
      break;
    case 'error':
      coloredData = chalk.bold.hex('#FF0000')('[ Delta Error ] > ') + chalk.bold.red(data);
      console.log(coloredData);
      break;
    default:
      coloredData = gradient('#ed3491', '#cb34ed', '#347bed', '#deed34').multiline('[ FCA-DELTA ] - ' + data);
      console.log(chalk.bold(coloredData));
      break;
  }
};

module.exports.autoLogin = async (onBot, botData) => {
onBot(botData);
};