//Load config file
let config = require('./config');
let package = require('./package.json');

//Polka - A micro web server so fast, it'll make you dance!👯
let polka = require('polka');
let app = polka();

let path = require('path');
let fs = require('fs');
let bodyParser = require('body-parser');
let serveStatic = require('serve-static');
app.use(bodyParser.json({}));

let exec = require('child_process').exec;

//moment.js
let moment = require('moment');

//Include domains routes
require('./routes/domains')(app);
//Include certificates routes
require('./routes/certificates')(app);

//CronJob for checking certificates
let CronJob = require('cron').CronJob;
const certJob = new CronJob('01 */12 * * *', function() {
  //Checking certificates from /ect/haproxy/certs
  console.log('Checking if a certificate is expired:');
  fs.readdir('/etc/haproxy/certs', function (err, files) {
    if (err) {
      console.log('Unable to scan directory with certificates: ' + err);
    }
    files.forEach(function (file) {
      var command = `date --date="$(openssl x509 -in /etc/haproxy/certs/${file} -noout -enddate | cut -d= -f 2)" --iso-8601`;
      exec(command, function (err, stdout, stderr) {
        console.log(`* ${file} - expired: ${stdout}`);
        if (err != null){

        }
        var now = moment();
        var certExpDate = moment(stdout);
        console.log(certExpDate.diff(now)/(1000*3600*24));
        //It's time to renew a certificate
        if (certExpDate.diff(now)/(1000*3600*24) < 4){
          let domain = file.replace('.pem','');
          console.log(`It's time to renew a certificate for ${domain}`);
          command = `certbot certonly --force-renewal --webroot -d ${domain}`;
          exec(command, function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            command = `DOMAIN='${domain}' sudo -E bash -c 'cat /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/letsencrypt/live/$DOMAIN/privkey.pem > /etc/haproxy/certs/$DOMAIN.pem'`;
            exec(command, function (err, stdout, stderr) {
              console.log(stdout);
              exec(`service haproxy restart`, function (err, stdout, stderr) {
                console.log(stdout);
              });
            });
          });
        }
      });
    });
  });
});
certJob.start();

//Check if Coded Node is available
app.get('/hey', function (req, res) {
  res.statusCode = 200;
  let json = JSON.stringify({ result: true, message: "Hey! I'm working!" });
  res.end(json);
});

//Start Coded Cluster
app.listen(config.PORT, err => {
    if (err) throw err;
    console.log(`> Running on localhost:${config.PORT}`);
    console.log(`> Version: ${package.version}`);
});
