"use strict";

/*
 * Created with @iobroker/create-adapter v1.18.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");

class SwissWeatherApi extends utils.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "swiss-weather-api",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("objectChange", this.onObjectChange.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		var self = this;
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info("config option1: " + this.config.App_Name);
		this.log.info("config option2: " + this.config.Base64_ConsumerKey_ConsumerSecret);
		this.log.info("config option3 " + this.config.Latitude);
		this.log.info("config option4: " + this.config.Longitude);

		/*Read SRG-SSR Weather API
		 https://developer.srgssr.ch/content/quickstart-guide

			 Encode Consumer Key & Consumer Secret :
			 $ echo -n foo:foo | base64

		 Use Encoded Consumer Key & Consumer Secret in curl-request
		 	curl -X POST \
  			'https://api.srgssr.ch/oauth/v1/accesstoken?grant_type=client_credentials' \
  			-H 'Authorization: Basic  <Consumer Key & Consumer Secret>' \
  			-H 'Cache-Control: no-cache' \
  			-H 'Content-Length: 0' \
  			-H 'Postman-Token: 24264e32-2de0-f1e3-f3f8-eab014bb6d76'

		curl-Code um die Daten abzuholen. Das Access_Token wird als "bearer" mitgegeben. Diesen bearer habe ich auf dem
		 Developer Protal SRG erstellt. Wenn man den Bearer hat, geht die Abfrage so:

		curl -X GET \
    	'https://api.srgssr.ch/forecasts/v1.0/weather/24hour?latitude=47.037219&longitude=7.376170' \
    	-H 'Authorization: Bearer foo'

		 */


		//Get current Forecast
		var http = require("https");

		var options = {
			"method": "GET",
			"hostname": "api.srgssr.ch",
			"port": null,
			"path": "/forecasts/v1.0/weather/current/?latitude=47.037219&longitude=7.376170",
			"headers": {
				"authorization": "Basic dmFyaWFAaW50ZWxsaS5jaDpNWiFQTEdGS11vdnQ="
			}
		};

		var req = http.request(options, function (res) {
			var chunks = [];

			res.on("data", function (chunk) {
				chunks.push(chunk);
			});

			res.on("end", function () {
				var body = Buffer.concat(chunks);
				self.log.info(body.toString());
			});
		});

		req.end();

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		await this.setObjectAsync("testVariable", {
			type: "state",
			common: {
				name: "testVariable",
				type: "boolean",
				role: "indicator",
				read: true,
				write: true,
			},
			native: {},
		});

		// in this template all states changes inside the adapters namespace are subscribed
		this.subscribeStates("*");

		/*
		setState examples
		you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync("admin", "iobroker");
		this.log.info("check user admin pw ioboker: " + result);

		result = await this.checkGroupAsync("admin", "admin");
		this.log.info("check group user admin group admin: " + result);

		// Setze ein Timeout. Nach 10s wird der eigene Prozess gekillt.
		// Gefühlt ein ziemlicher Hack. Wenn man den Timeout hier nicht setzt, wird der Prozess nicht
		// wieder gestartet obschon das Ding als "schedule" im io-package.json definiert wurde...
		// ioBroker würde dann melden "Process already runnung" und kein restart durchführen
		setTimeout(this.stop.bind(this), 10000);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.log.info("cleaned everything up...");
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		if (obj) {
			// The object was changed
			this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
		} else {
			// The object was deleted
			this.log.info(`object ${id} deleted`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.message" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new SwissWeatherApi(options);
} else {
	// otherwise start the instance directly
	new SwissWeatherApi();
}