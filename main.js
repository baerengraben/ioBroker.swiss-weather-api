"use strict";

/*
 * Created with @iobroker/create-adapter v1.18.0
 */
const utils = require("@iobroker/adapter-core");
var http = require("https");

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
		 * First get Access_Token, after that get forcast-informations for
		 * - current forecast
		 * - week forecast
		 * - next hour forecast
		 * - 24 hour forecast
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
						var body = JSON.parse(Buffer.concat(chunks).toString());
						self.log.info("Current Forecast: " + JSON.stringify(body));

						//Set Current Forecast Values
						self.setObjectNotExists("CurrentForecast." + "formatted_date" , {
							type: "state",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast." + "formatted_date", { val: body.formatted_date.toString(), ack: true });

						self.setObjectNotExists("CurrentForecast.current_day.date" , {
							type: "state",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.current_day.date", { val: body.current_day.date.toString(), ack: true });

						self.log.info("Units: " + JSON.stringify(body.units.ttn));
						self.setObjectNotExists("CurrentForecast.current_day.values.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.current_day.values.ttn", { val: body.current_day.values[0].ttn, ack: true });

						self.setObjectNotExists("CurrentForecast.current_day.values.smbd" , {
							type: "state",
							common: {
								name: body.units.smbd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.current_day.values.smbd", { val: body.current_day.values[1].smbd, ack: true });

						self.setObjectNotExists("CurrentForecast.current_day.values.ttx" , {
							type: "state",
							common: {
								name: body.units.ttx.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.current_day.values.ttx", { val: body.current_day.values[2].ttx, ack: true });

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

						//todo: Set Weekly Forecast Values


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

						//todo: Set Hour Forecast Values


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

						//todo: Set 24Hour Forecast Values


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