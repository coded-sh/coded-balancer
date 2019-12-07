let Utils = require('../utils');
let utils = new Utils();
let config = require('../config');

let fs = require('fs');
let request = require('request');
let exec = require('child_process').exec;

module.exports = function(app){

  app.post('/certificate', async (req, res) => {
    let domainName = req.body.domain;
    //Check if a certificate exists
    if (fs.existsSync(`/etc/haproxy/certs/${domainName}.pem`) == true){
      res.statusCode = 403;
      let json = JSON.stringify({ result: false, message:`Certificate for ${domainName} is already created` });
      res.end(json);
      return;
    }
    //Load haproxy.cfg
    var haproxycfg = '/etc/haproxy/haproxy.cfg';
    fs.readFile(haproxycfg, function (err, loadedConfigContent) {
      if (err == null) {
        //Replace frontend for domainName from ${domainName}_backend to cert_assist_backend to handle certbot --webroot requests
        var configContent = loadedConfigContent.toString().replace(`use_backend ${domainName}_backend`, `use_backend cert_assist_backend`);
        fs.writeFile(haproxycfg, configContent, function (err) {
          if (err) {
            console.log(err);
            res.statusCode = 403;
            let json = JSON.stringify({ result: false, message:`Error: ${err}` });
            res.end(json);
            return;
          }
          //Restart haproxy
          var command = 'service haproxy restart';
          exec(command, function (err, stdout, stderr) {
            //Start certbot --webroot
            command = `certbot certonly --webroot -w /root/certbot-assist -d ${domainName} --non-interactive --agree-tos -m certs@coded.sh`;
            exec(command, function (err, stdout, stderr) {
              //Create a certificate for haproxy
              command = `DOMAIN='${domainName}' sudo -E bash -c 'cat /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/letsencrypt/live/$DOMAIN/privkey.pem > /etc/haproxy/certs/$DOMAIN.pem'`;
              exec(command, function (err, stdout, stderr) {
                fs.readFile(haproxycfg, function (err, loadedConfigContent) {
                  if (err == null) {
                    //Replace frontend for domainName from cert_assist_backend to ${domainName}_backend back
                    configContent = loadedConfigContent.toString().replace(`use_backend cert_assist_backend`, `use_backend ${domainName}_backend`);
                    //Add a new certificate to haproxy.cfg
                    configContent = configContent.replace(`bind *:443 ssl `, `bind *:443 ssl crt /etc/haproxy/certs/${domainName}.pem `);
                    //Will work only for new coded-balancer (#certificates is used in coded-cluster haproxy.cfg template)
                    configContent = configContent.replace(`#certificates`, `bind *:443 ssl crt /etc/haproxy/certs/${domainName}.pem `);
                    fs.writeFile(haproxycfg, configContent, function (err) {
                      if (err) {
                        console.log(err);
                        res.statusCode = 403;
                        let json = JSON.stringify({ result: false, message:`Error: ${err}` });
                        res.end(json);
                        return;
                      }
                      //Restart haproxy
                      command = 'service haproxy restart';
                      exec(command, function (err, stdout, stderr) {
                        res.statusCode = 201;
                        let json = JSON.stringify({ result: true });
                        res.end(json);
                        return;
                      });
                    });
                  }
                });
              });
            });
          });
        });
      }
    });
  });

}
