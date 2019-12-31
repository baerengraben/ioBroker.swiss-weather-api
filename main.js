"use strict";

/*
 * Created with @iobroker/create-adapter v1.18.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
var http = require("https");

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
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		var self = this;
		var appName = this.config.App_Name;
		var latitude = this.config.Latitude;
		var longitude = this.config.Longitude;
		var consumerKey = this.config.ConsumerKey;
		var consumerSecret = this.config.ConsumerSecret;
		var access_token;

		this.log.debug("App Name: " + appName);
		this.log.debug("Consumer Key: " + consumerKey);
		this.log.debug("Consumer Secret: " + consumerSecret);
		this.log.debug("Latitude " + latitude);
		this.log.debug("Longitude: " + longitude);

		//Convert ConsumerKey and ConsumerSecret to base64
		let data = consumerKey + ":" + consumerSecret;
		let buff = new Buffer(data);
		let base64data = buff.toString('base64');
		this.log.debug('"' + data + '" converted to Base64 is "' + base64data + '"');

		//Options for getting Access-Token
		var options_Access_Token = {
			"json": true,
			"method": "POST",
			"hostname": "api.srgssr.ch",
			"port": null,
			"path": "/oauth/v1/accesstoken?grant_type=client_credentials",
			"headers": {
				"Authorization": "Basic " + base64data,
				"Cache-Control": "no-cache",
				"Content-Length": 0,
				"Postman-Token": "24264e32-2de0-f1e3-f3f8-eab014bb6d76"
			}
		};

		/**
		 * First get Access_Token, after that get forcast-informations
		 */
		var req = http.request(options_Access_Token, function (res) {
			var chunks = [];
			res.on("data", function (chunk) {
				chunks.push(chunk);
			});
			res.on("end", function () {
				var body = JSON.parse(Buffer.concat(chunks).toString());
				access_token = body.access_token.toString();
				self.log.debug("Access_Token : " + access_token);

				//Options for getting current Forecast using Authorization Bearer
				var options_current_forecast = {
					"method": "GET",
					"hostname": "api.srgssr.ch",
					"port": null,
					"path": "/forecasts/v1.0/weather/current?latitude=" + latitude + "&longitude=" + longitude,
					"headers": {
						"authorization": "Bearer " + access_token
					}
				};
				var reqCurrentForecast = http.request(options_current_forecast, function (res) {
					var chunks = [];
					res.on("data", function (chunk) {
						chunks.push(chunk);
					});
					res.on("end", function () {
						var body = Buffer.concat(chunks);
						self.log.info("Current Forecast: " + body.toString());

						//todo: Set Forecast Values


					});
					res.on("error", function (error) {
						self.log.error(error)
					});
				});
				reqCurrentForecast.end();

				//Options for getting week forecast using Authorization Bearer
				var options_weeks_forecast = {
					"method": "GET",
					"hostname": "api.srgssr.ch",
					"port": null,
					"path": "/forecasts/v1.0/weather/7day?latitude=" + latitude + "&longitude=" + longitude,
					"headers": {
						"authorization": "Bearer " + access_token
					}
				};
				var reqWeekForecast = http.request(options_weeks_forecast, function (res) {
					var chunks = [];
					res.on("data", function (chunk) {
						chunks.push(chunk);
					});
					res.on("end", function () {
						var body = Buffer.concat(chunks);
						self.log.info("Week Forecast: " + body.toString());

						//todo: Set Forecast Values


					});
					res.on("error", function (error) {
						self.log.error(error)
					});
				});
				reqWeekForecast.end();

				//Options for getting hour forecast using Authorization Bearer
				var options_hour_forecast = {
					"method": "GET",
					"hostname": "api.srgssr.ch",
					"port": null,
					"path": "/forecasts/v1.0/weather/nexthour?latitude=" + latitude + "&longitude=" + longitude,
					"headers": {
						"authorization": "Bearer " + access_token
					}
				};
				var reqHourForecast = http.request(options_hour_forecast, function (res) {
					var chunks = [];
					res.on("data", function (chunk) {
						chunks.push(chunk);
					});
					res.on("end", function () {
						var body = Buffer.concat(chunks);
						self.log.info("Hour Forecast: " + body.toString());

						//todo: Set Forecast Values


					});
					res.on("error", function (error) {
						self.log.error(error)
					});
				});
				reqHourForecast.end();

				//Options for getting 24hour forecast using Authorization Bearer
				var options_24hour_forecast = {
					"method": "GET",
					"hostname": "api.srgssr.ch",
					"port": null,
					"path": "/forecasts/v1.0/weather/24hour?latitude=" + latitude + "&longitude=" + longitude,
					"headers": {
						"authorization": "Bearer " + access_token
					}
				};
				var req24HourForecast = http.request(options_24hour_forecast, function (res) {
					var chunks = [];
					res.on("data", function (chunk) {
						chunks.push(chunk);
					});
					res.on("end", function () {
						var body = Buffer.concat(chunks);
						self.log.info("24Hour Forecast: " + body.toString());

						//todo: Set Forecast Values


					});
					res.on("error", function (error) {
						self.log.error(error)
					});
				});
				req24HourForecast.end();
			});
			res.on("error", function (error) {
				self.log.error(error)
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