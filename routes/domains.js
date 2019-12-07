const Utils = require('../utils');
const utils = new Utils();
const config = require('../config');

let fs = require('fs');
var qs = require('querystring');
const request = require('request');
const exec = require('child_process').exec;

let frontendTemplate =
`	acl #some_domain#_acl hdr(host) -i #some_domain#
	use_backend #some_domain#_backend if #some_domain#_acl
`;

let backendTemplate =
`backend #some_domain#_backend
    server #some_domain# #some_ip#:#some_port#
`;

module.exports = function(app){

  app.post('/domain', async (req, res) => {

    const domain = req.body.domain;
    const ip = req.body.ip;
    const port = req.body.port;

    //Load haproxy.cfg
    var haproxycfg = '/etc/haproxy/haproxy.cfg';
    fs.readFile(haproxycfg, function (err, loadedConfigContent) {
      if (err == null) {
        //Replace frontend for domainName from ${domainName}_backend to cert_assist_backend to handle certbot --webroot requests
        var newFrontend = utils.replaceAll(frontendTemplate, "#some_domain#", domain);
        var newBackend = utils.replaceAll(backendTemplate, "#some_domain#", domain);
        newBackend = utils.replaceAll(newBackend, "#some_ip#", ip);
        newBackend = utils.replaceAll(newBackend, "#some_port#", port);

        var configContent = loadedConfigContent.toString().replace(`# User frontends`, `# User frontends\n${newFrontend}`);
        configContent = configContent.replace(`# User backends`, `# User backends\n${newBackend}`);
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
						//Generate certificate
						var certificateBody = {};
						certificateBody["domain"] = domain;
						var options = {
								method: 'POST',
								json: true,
								url: `http://localhost:3004/certificate`, //coded-balancer container local ip
								body: certificateBody
						};
						request(options, function (error, serverResponse, body) {
								if (error != null){
									console.log(`POST /certificate error: ${error}`);
								}
						});
						//Send response
            res.statusCode = 201;
            let json = JSON.stringify({ result: true });
            res.end(json);
            return;
          });
        });
      }else{
        console.log(err);
        res.statusCode = 403;
        let json = JSON.stringify({ result: false, message:`Error: ${err}` });
        res.end(json);
        return;
      }
    });
  });
}
