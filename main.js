"use strict";

/*
 * Created with @iobroker/create-adapter v1.18.0
 */
const utils = require("@iobroker/adapter-core");
const http = require("https");
const fs = require('fs');
const libxmljs = require('libxmljs2');
var path = require('path');
var xml;
var xmlDoc;
var timeout;
var geolocationId;

class SwissWeatherApi extends utils.Adapter {
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		// @ts-ignore
		super({
			...options,
			name: "swiss-weather-api",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
//		var myself = this;
		getSystemData(this); // read Longitude und Latitude
		GetGeolocationId(this); // get geolocation id in order to read forecast by id
//		setTimeout(doIt, 10000, myself); // First start after 10s
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.log.debug("cleaned everything up...");
			clearTimeout(timeout);
			callback();
		} catch (e) {
			callback();
		}
	}
}

/**
 * Get longitude/latitude from system if not set or not valid
 * do not change if we have already a valid value
 * so we could use different settings compared to system if necessary
 * @param self Adapter
 */
function getSystemData(self) {
	if (typeof self.config.Longitude == undefined || self.config.Longitude == null || self.config.Longitude.length == 0 || isNaN(self.config.Longitude)
		|| typeof self.config.Latitude == undefined || self.config.Latitude == null || self.config.Latitude.length == 0 || isNaN(self.config.Latitude)) {
		self.log.info("longitude/longitude not set, get data from system ");
		self.getForeignObject("system.config", (err, state) => {
			if (err || state === undefined || state === null) {
				self.log.error("longitude/latitude not set in adapter-config and reading in system-config failed");
			} else {
				self.config.Longitude = state.common.longitude;
				self.config.Latitude = state.common.latitude;
				self.log.info("system  longitude: " + self.config.Longitude + " latitude: " + self.config.Latitude);
			}
		});
	} else {
		self.log.info("longitude/longitude will be set by self-Config - longitude: " + self.config.Longitude + " latitude: " + self.config.Latitude);
	}
}

function getToken(self){
	var access_token;

	//Convert ConsumerKey and ConsumerSecret to base64
	let data = self.config.ConsumerKey + ":" + self.config.ConsumerSecret;
	let buff = Buffer.from(data);
	let base64data = buff.toString('base64');
	self.log.debug('"' + data + '" converted to Base64 is "' + base64data + '"');

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

	var req = http.request(options_Access_Token, function (res) {
		var chunks = [];
		res.on("data", function (chunk) {
			chunks.push(chunk);
		});
		res.on("end", function () {
			var body = JSON.parse(Buffer.concat(chunks).toString());
			if (body.access_token === undefined) {
				self.log.warn("Got no Token - Is Adapter correctly configured (ConsumerKey/ConsumerSecret)?;");
				return;
			}
			access_token = body.access_token.toString();
			self.log.debug("Access_Token : " + access_token);
		});
		res.on("error", function (error) {
			self.log.error(error)
		});
	});
	req.end();

	return access_token;
}

function GetGeolocationId(self){
	// First get Access Token
	var access_token;
	//Convert ConsumerKey and ConsumerSecret to base64
	let data = self.config.ConsumerKey + ":" + self.config.ConsumerSecret;
	let buff = Buffer.from(data);
	let base64data = buff.toString('base64');
	self.log.debug('"' + data + '" converted to Base64 is "' + base64data + '"');

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

	var req = http.request(options_Access_Token, function (res) {
		var chunks = [];
		res.on("data", function (chunk) {
			chunks.push(chunk);
		});
		res.on("end", function () {
			var body = JSON.parse(Buffer.concat(chunks).toString());
			if (body.access_token === undefined) {
				self.log.warn("Got no Token - Is Adapter correctly configured (ConsumerKey/ConsumerSecret)?;");
				return;
			}
			access_token = body.access_token.toString();
			self.log.debug("Access_Token : " + access_token);

			//Now get GeolocationId
			//Options for getting current Geolocation id
			var options_geolocationId = {
				"method": "GET",
				"hostname": "api.srgssr.ch",
				"port": null,
				"path": "/srf-meteo/geolocations/?latitude=" + self.config.Latitude + "&longitude=" + self.config.Longitude,
				"headers": {
					"authorization": "Basic " + access_token
				}
			};

			self.log.debug("Options to get GeolocationId: " + options_geolocationId.toString())

			//set request
			var req = http.request(options_geolocationId, function (res) {
				var chunks = [];
				res.on("data", function (chunk) {
					chunks.push(chunk);
				});
				res.on("end", function () {
					self.log.debug(Buffer.concat(chunks).toString());
					// var body = JSON.parse(Buffer.concat(chunks).toString());
					// if (body.access_token === undefined) {
					// 	self.log.warn("Got no Token - Is Adapter correctly configured (ConsumerKey/ConsumerSecret)?;");
					// 	return;
					// }
					//
					// if (body.code !== undefined) {
					// 	self.log.debug("Current Forecast - Return Code: " + body.code.toString());
					// 	if (body.code.toString().startsWith("404")) {
					// 		self.log.error("Get Gelocation id - Resource not found");
					// 		return;
					// 	} else if (body.code.toString().startsWith("400")){
					// 		self.log.error("Get Gelocation id -  Invalid request");
					// 		self.log.error("Current Forecast - An error has occured. " + JSON.stringify(body));
					// 		return;
					// 	} else if (body.code.toString().startsWith("401")){
					// 		self.log.error("Get Gelocation id -  Invalid or expired access token ");
					// 		self.log.error("Current Forecast - An error has occured. " + JSON.stringify(body));
					// 		return;
					// 	} else {
					// 		self.log.error("Current Forecast - An error has occured. " + JSON.stringify(body));
					// 		return;
					// 	}
					// }
					//
					// // show answer
					// self.log.debug(body.code.t());

				});
				res.on("error", function (error) {
					self.log.error(error)
				});
			});
			req.end();
		});
		res.on("error", function (error) {
			self.log.error(error)
		});
	});
	req.end();


}

// var doIt = function(self) {
// 	self.log.info("Swiss-Weather-API: Get Weather Infos...");
//
// 	var appName = self.config.App_Name;
// 	var latitude = self.config.Latitude;
// 	var longitude = self.config.Longitude;
// 	var consumerKey = self.config.ConsumerKey;
// 	var consumerSecret = self.config.ConsumerSecret;
// 	var pollInterval = self.config.PollInterval * 60000; //Convert minute to miliseconds
//
// 	var icon = "";
//
// 	//Mandantory Attributes
// 	if (latitude === undefined) {
// 		self.log.warn("Got no latitude - Is adapter correctly configured (latitude)?;");
// 		return;
// 	} else if (longitude === undefined) {
// 		self.log.warn("Got no longitude - Is adapter correctly configured (longitude)?;");
// 		return;
// 	} else if (consumerKey === undefined) {
// 		self.log.warn("Got no consumerKey - Is adapter correctly configured (consumerKey)?;");
// 		return;
// 	} else if (consumerSecret === undefined) {
// 		self.log.warn("Got no consumerSecret - Is adapter correctly configured (consumerSecret)?;");
// 		return;
// 	} else if (pollInterval === undefined) {
// 		self.log.warn("Got no pollInterval - Is adapter correctly configured (pollInterval)?;");
// 		return;
// 	}
//
// 	self.log.debug("App Name: " + appName);
// 	self.log.debug("Consumer Key: " + consumerKey);
// 	self.log.debug("Consumer Secret: " + consumerSecret);
// 	self.log.debug("Latitude " + latitude);
// 	self.log.debug("Longitude: " + longitude);
// 	self.log.debug("Poll Interval: " + pollInterval);
//
// 	//Prepare XML File in order to get the weather-icon
// 	self.log.debug("Define XML File:...");
// 	try {
// 		xml = fs.readFileSync(path.join(__dirname, 'img', 'weather-icons', 'SRG-SSR-WeatherAPITranslations.xml'));
// 		xmlDoc = libxmljs.parseXmlString(xml);
// 	} catch (err) {
// 		self.log.error("An error has occured while trying to read SRG-SSR-WeatherAPITranslations.xml. Please create an Issue on Github Project-Site. Error Code is: " + err.code);
// 		return;
// 	}
//
// 	//Convert ConsumerKey and ConsumerSecret to base64
// 	let data = consumerKey + ":" + consumerSecret;
// 	let buff = Buffer.from(data);
// 	let base64data = buff.toString('base64');
// 	self.log.debug('"' + data + '" converted to Base64 is "' + base64data + '"');
//
// 	//Options for getting Access-Token
// 	var options_Access_Token = {
// 		"json": true,
// 		"method": "POST",
// 		"hostname": "api.srgssr.ch",
// 		"port": null,
// 		"path": "/oauth/v1/accesstoken?grant_type=client_credentials",
// 		"headers": {
// 			"Authorization": "Basic " + base64data,
// 			"Cache-Control": "no-cache",
// 			"Content-Length": 0,
// 			"Postman-Token": "24264e32-2de0-f1e3-f3f8-eab014bb6d76"
// 		}
// 	};
//
// 	/**
// 	 * First get Access_Token, afterwards get forcast-informations for
// 	 * - current forecast
// 	 * - week forecast
// 	 * - next hour forecast
// 	 * - 24 hour forecast
// 	 */
// 	var req = http.request(options_Access_Token, function (res) {
// 		var chunks = [];
// 		res.on("data", function (chunk) {
// 			chunks.push(chunk);
// 		});
// 		res.on("end", function () {
// 			var body = JSON.parse(Buffer.concat(chunks).toString());
// 			if (body.access_token === undefined) {
// 				self.log.warn("Got no Token - Is Adapter correctly configured (ConsumerKey/ConsumerSecret)?;");
// 				return;
// 			}
// 			access_token = body.access_token.toString();
// 			self.log.debug("Access_Token : " + access_token);
//
// 			//********************************************************************************************
// 			//* Read Current Forcast
// 			//********************************************************************************************
//
// 			//Options for getting current Forecast using Authorization Bearer
// 			var options_current_forecast = {
// 				"method": "GET",
// 				"hostname": "api.srgssr.ch",
// 				"port": null,
// 				"path": "/forecasts/v1.0/weather/current?latitude=" + latitude + "&longitude=" + longitude,
// 				"headers": {
// 					"authorization": "Bearer " + access_token
// 				}
// 			};
//
// 			var reqCurrentForecast = http.request(options_current_forecast, function (res) {
// 				var chunks = [];
// 				res.on("data", function (chunk) {
// 					chunks.push(chunk);
// 				});
// 				res.on("end", function () {
// 					var body = JSON.parse(Buffer.concat(chunks).toString());
// 					self.log.debug("Current Forecast: " + JSON.stringify(body));
//
// 					//Check for errors in response
// 					if (body.fault !== undefined) {
// 						self.log.error("Response has announced an error: " + body.fault.faultstring);
// 						if (body.fault.detail.errorcode.includes('InvalidAPICallAsNoApiProductMatchFound')){
// 							self.log.error("InvalidAPICallAsNoApiProductMatchFound: Wrong SRF-Product is linked to your SRF-App. Please choose the free SRF Product 'SRG-SSR-PUBLIC-API-V2'. Other SRF Prducts are not supported at the moment");
// 						}
// 						return;
// 					}
//
// 					if (body.code !== undefined) {
// 						self.log.debug("Current Forecast - Return Code: " + body.code.toString());
// 						if (body.code.toString() === "404.02.001") {
// 							self.log.error("Current Forecast - Requested Location is not supported. Please be aware, that this adapter only supports locations within Switzerland.");
// 							return;
// 						} else {
// 							self.log.error("Current Forecast - An error has occured. " + JSON.stringify(body));
// 							return;
// 						}
// 					}
//
// 					//**********************
// 					//*** Formatted Date
// 					//**********************
// 					//Set Current Forecast Values
// 					self.setObjectNotExists("CurrentForecast." + "formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast." + "formatted_date", {
// 							val: body.formatted_date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					//**********************
// 					//*** Current Day
// 					//**********************
// 					self.setObjectNotExists("CurrentForecast.current_day.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast.current_day.date", {
// 							val: body.current_day.date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("CurrentForecast.current_day.values.ttn", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttn.name + " " + body.units.ttn.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast.current_day.values.ttn", {
// 							val: body.current_day.values[0].ttn,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("CurrentForecast.current_day.values.smbd", {
// 						type: "state",
// 						common: {
// 							name: body.units.smbd.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast.current_day.values.smbd", {
// 							val: body.current_day.values[1].smbd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("CurrentForecast.current_day.values.ttx", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttx.name + " " + body.units.ttx.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast.current_day.values.ttx", {
// 							val: body.current_day.values[2].ttx,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name for current_day
// 					self.log.debug("get icon-url by xpath for current day");
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.current_day.values[1].smbd + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.current_day.values[1].smbd);
// 					} else {
// 						icon = gchild.text();
// 					}
//
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("CurrentForecast.current_day.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name current_day: " + this.icon);
// 						self.setState("CurrentForecast.current_day.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("CurrentForecast.current_day.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast.current_day.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.current_day.values[1].smbd + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("CurrentForecast.current_day.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast.current_day.values.icon-name", {
// 							val: this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
//
// 					//**********************
// 					//*** Current Hour
// 					//**********************
// 					if (Object.keys(body.current_hour).length > 0) {
// 						self.setObjectNotExists("CurrentForecast.current_hour.date", {
// 							type: "state",
// 							common: {
// 								name: "date",
// 								type: "string",
// 								role: "date"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.date", {
// 								val: body.current_hour[0].date.toString(),
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.smb3", {
// 							type: "state",
// 							common: {
// 								name: body.units.smb3.name,
// 								type: "string",
// 								role: "value"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.smb3", {
// 								val: body.current_hour[0].values[0].smb3,
// 								ack: true
// 							});
// 						});
//
// 						//read icon-name for current_hour
// 						self.log.debug("get icon-url by xpath for current hour");
// 						var gchild = xmlDoc.get("/root/row[Code=" + body.current_hour[0].values[0].smb3 + "]/Code_icon");
// 						if (gchild == undefined) {
// 							icon = "notavailable";
// 							self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.current_hour[0].values[0].smb3);
// 						} else {
// 							icon = gchild.text();
// 						}
// 						self.log.debug("Weather-Icon Name: " + icon);
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.icon-url", {
// 							type: "state",
// 							common: {
// 								name: "icon-url",
// 								type: "string",
// 								role: "weather.icon"
// 							},
// 							native: {},
// 						}, function () {
// 							self.log.debug("Weather-Icon Name current_hour: " + this.icon);
// 							self.setState("CurrentForecast.current_hour.values.icon-url", {
// 								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 								ack: true
// 							});
// 						}.bind({icon: icon}));
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.icon-url-srgssr", {
// 							type: "state",
// 							common: {
// 								name: "icon-url-srgssr",
// 								type: "string",
// 								role: "weather.icon"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.icon-url-srgssr", {
// 								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.current_hour[0].values[0].smb3 + ".png",
// 								ack: true
// 							});
// 						}.bind({icon: icon}));
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.icon-name", {
// 							type: "state",
// 							common: {
// 								name: "icon-name",
// 								type: "string",
// 								role: "weather.icon"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.icon-name", {
// 								val: this.icon + ".png",
// 								ack: true
// 							});
// 						}.bind({icon: icon}));
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.ttt", {
// 							type: "state",
// 							common: {
// 								name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 								type: "number",
// 								role: "value.temperature"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.ttt", {
// 								val: body.current_hour[0].values[1].ttt,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.fff", {
// 							type: "state",
// 							common: {
// 								name: body.units.fff.name + " in " + body.units.fff.unit,
// 								type: "number",
// 								role: "value.temperature"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.fff", {
// 								val: body.current_hour[0].values[2].fff,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.ffx3", {
// 							type: "state",
// 							common: {
// 								name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 								type: "number",
// 								role: "value.temperature"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.ffx3", {
// 								val: body.current_hour[0].values[3].ffx3,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.ddd", {
// 							type: "state",
// 							common: {
// 								name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 								type: "number",
// 								role: "value"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.ddd", {
// 								val: body.current_hour[0].values[4].ddd,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.rr3", {
// 							type: "state",
// 							common: {
// 								name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 								type: "number",
// 								role: "value"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.rr3", {
// 								val: body.current_hour[0].values[5].rr3,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("CurrentForecast.current_hour.values.pr3", {
// 							type: "state",
// 							common: {
// 								name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 								type: "number",
// 								role: "value"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("CurrentForecast.current_hour.values.pr3", {
// 								val: body.current_hour[0].values[6].pr3,
// 								ack: true
// 							});
// 						});
// 					} else {
// 						self.log.warn("CurrentForecast - Current_hour is empty. Do no import for this cycle")
// 					}
//
// 					//**********************
// 					//*** Info
// 					//**********************
// 					self.setObjectNotExists("info.id", {
// 						type: "state",
// 						common: {
// 							name: "id",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("info.id", {val: body.info.id, ack: true});
// 					});
//
// 					self.setObjectNotExists("info.plz", {
// 						type: "state",
// 						common: {
// 							name: "plz",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("info.plz", {val: body.info.plz, ack: true});
// 					});
//
// 					self.setObjectNotExists("info.name.de", {
// 						type: "state",
// 						common: {
// 							name: "name",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("info.name.de", {val: body.info.name.de, ack: true});
// 					});
//
// 					self.setObjectNotExists("CurrentForecast.status", {
// 						type: "state",
// 						common: {
// 							name: "status",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast.status", {val: "Success", ack: true});
// 					});
//
// 				});
// 				res.on("error", function (error) {
// 					self.log.error(error);
// 					self.setObjectNotExists("CurrentForecast.status", {
// 						type: "state",
// 						common: {
// 							name: "status",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("CurrentForecast.status", {val: error, ack: true});
// 					});
// 				});
// 			});
// 			reqCurrentForecast.end();
//
// 			//********************************************************************************************
// 			//* Read Week Forcast
// 			//********************************************************************************************
//
// 			//Options for getting week forecast using Authorization Bearer
// 			var options_weeks_forecast = {
// 				"method": "GET",
// 				"hostname": "api.srgssr.ch",
// 				"port": null,
// 				"path": "/forecasts/v1.0/weather/7day?latitude=" + latitude + "&longitude=" + longitude,
// 				"headers": {
// 					"authorization": "Bearer " + access_token
// 				}
// 			};
// 			var reqWeekForecast = http.request(options_weeks_forecast, function (res) {
// 				var chunks = [];
// 				res.on("data", function (chunk) {
// 					chunks.push(chunk);
// 				});
// 				res.on("end", function () {
// 					var chunksConcat = Buffer.concat(chunks).toString();
// 					chunksConcat = chunksConcat.replace(/7days/g, "sevendays");
// 					self.log.debug("chunksConcat: " + chunksConcat);
// 					var body = JSON.parse(chunksConcat);
// 					self.log.debug("Week Forecast: " + JSON.stringify(body));
//
// 					//Check for errors in response
// 					if (body.fault !== undefined) {
// 						self.log.error("Response has announced an error: " + body.fault.faultstring);
// 						if (body.fault.detail.errorcode.includes('InvalidAPICallAsNoApiProductMatchFound')){
// 							self.log.error("InvalidAPICallAsNoApiProductMatchFound: Wrong SRF-Product is linked to your SRF-App. Please choose the free SRF Product 'SRG-SSR-PUBLIC-API-V2'. Other SRF Prducts are not supported at the moment");
// 						}
// 						return;
// 					}
//
// 					if (body.code !== undefined) {
// 						self.log.debug("Week Forecast:  - Return Code: " + body.code.toString());
// 						if (body.code.toString() === "404.02.001") {
// 							self.log.error("Week Forecast - Requested Location is not supported. Please be aware, that this adapter only supports locations within Switzerland.");
// 							return;
// 						} else {
// 							self.log.error("Week Forecast - An error has occured. " + JSON.stringify(body));
// 							return;
// 						}
// 					}
//
// 					//**********************
// 					//*** Day 0
// 					//**********************
// 					self.setObjectNotExists("WeekForecast.day0.formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day0.formatted_date", {
// 							val: body.sevendays[0].formatted_date,
// 							ack: true
// 						});
// 					});
// 					self.setObjectNotExists("WeekForecast.day0.ttn", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttn.name + " " + body.units.ttn.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day0.ttn", {val: body.sevendays[0].values[0].ttn, ack: true});
// 					});
// 					self.setObjectNotExists("WeekForecast.day0.smbd", {
// 						type: "state",
// 						common: {
// 							name: body.units.smbd.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day0.smbd", {val: body.sevendays[0].values[1].smbd, ack: true});
// 					});
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for weekforecast.day0");
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[0].values[1].smbd + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.sevendays[0].values[1].smbd);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("WeekForecast.day0.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name day0: " + this.icon);
// 						self.setState("WeekForecast.day0.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day0.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day0.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.sevendays[0].values[1].smbd + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day0.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day0.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day0.ttx", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttx.name + " " + body.units.ttx.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day0.ttx", {val: body.sevendays[0].values[2].ttx, ack: true});
// 					});
//
// 					//**********************
// 					//*** Day 1
// 					//**********************
// 					self.setObjectNotExists("WeekForecast.day1.formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day1.formatted_date", {
// 							val: body.sevendays[1].formatted_date,
// 							ack: true
// 						});
// 					});
// 					self.setObjectNotExists("WeekForecast.day1.ttn", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttn.name + " " + body.units.ttn.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day1.ttn", {val: body.sevendays[1].values[0].ttn, ack: true});
// 					});
// 					self.setObjectNotExists("WeekForecast.day1.smbd", {
// 						type: "state",
// 						common: {
// 							name: body.units.smbd.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day1.smbd", {val: body.sevendays[1].values[1].smbd, ack: true});
// 					});
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for weekforecast.day1");
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[1].values[1].smbd + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.sevendays[1].values[1].smbd);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("WeekForecast.day1.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name day1: " + this.icon);
// 						self.setState("WeekForecast.day1.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day1.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day1.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.sevendays[1].values[1].smbd + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day1.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day1.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day1.ttx", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttx.name + " " + body.units.ttx.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day1.ttx", {val: body.sevendays[1].values[2].ttx, ack: true});
// 					});
//
// 					//**********************
// 					//*** Day 2
// 					//**********************
// 					self.setObjectNotExists("WeekForecast.day2.formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day2.formatted_date", {
// 							val: body.sevendays[2].formatted_date,
// 							ack: true
// 						});
// 					});
// 					self.setObjectNotExists("WeekForecast.day2.ttn", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttn.name + " " + body.units.ttn.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day2.ttn", {val: body.sevendays[2].values[0].ttn, ack: true});
// 					});
// 					self.setObjectNotExists("WeekForecast.day2.smbd", {
// 						type: "state",
// 						common: {
// 							name: body.units.smbd.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day2.smbd", {val: body.sevendays[2].values[1].smbd, ack: true});
// 					});
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for weekforecast.day2");
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[2].values[1].smbd + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.sevendays[2].values[1].smbd);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("WeekForecast.day2.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name day2: " + this.icon);
// 						self.setState("WeekForecast.day2.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day2.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day2.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.sevendays[2].values[1].smbd + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day2.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day2.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day2.ttx", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttx.name + " " + body.units.ttx.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day2.ttx", {val: body.sevendays[2].values[2].ttx, ack: true});
// 					});
//
// 					//**********************
// 					//*** Day 3
// 					//**********************
// 					self.setObjectNotExists("WeekForecast.day3.formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day3.formatted_date", {
// 							val: body.sevendays[3].formatted_date,
// 							ack: true
// 						});
// 					});
// 					self.setObjectNotExists("WeekForecast.day3.ttn", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttn.name + " " + body.units.ttn.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day3.ttn", {val: body.sevendays[3].values[0].ttn, ack: true});
// 					});
// 					self.setObjectNotExists("WeekForecast.day3.smbd", {
// 						type: "state",
// 						common: {
// 							name: body.units.smbd.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day3.smbd", {val: body.sevendays[3].values[1].smbd, ack: true});
// 					});
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for weekforecast.day3");
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[3].values[1].smbd + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.sevendays[3].values[1].smbd);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("WeekForecast.day3.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name day3: " + this.icon);
// 						self.setState("WeekForecast.day3.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day3.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day3.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.sevendays[3].values[1].smbd + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day3.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day3.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day3.ttx", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttx.name + " " + body.units.ttx.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day3.ttx", {val: body.sevendays[3].values[2].ttx, ack: true});
// 					});
//
// 					//**********************
// 					//*** Day 4
// 					//**********************
// 					self.setObjectNotExists("WeekForecast.day4.formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day4.formatted_date", {
// 							val: body.sevendays[4].formatted_date,
// 							ack: true
// 						});
// 					});
// 					self.setObjectNotExists("WeekForecast.day4.ttn", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttn.name + " " + body.units.ttn.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day4.ttn", {val: body.sevendays[4].values[0].ttn, ack: true});
// 					});
// 					self.setObjectNotExists("WeekForecast.day4.smbd", {
// 						type: "state",
// 						common: {
// 							name: body.units.smbd.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day4.smbd", {val: body.sevendays[4].values[1].smbd, ack: true});
// 					});
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for weekforecast.day4");
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[4].values[1].smbd + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.sevendays[4].values[1].smbd);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("WeekForecast.day4.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name day4: " + this.icon);
// 						self.setState("WeekForecast.day4.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day4.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day4.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.sevendays[4].values[1].smbd + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day4.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day4.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day4.ttx", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttx.name + " " + body.units.ttx.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day4.ttx", {val: body.sevendays[4].values[2].ttx, ack: true});
// 					});
//
// 					//**********************
// 					//*** Day 5
// 					//**********************
// 					self.setObjectNotExists("WeekForecast.day5.formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day5.formatted_date", {
// 							val: body.sevendays[5].formatted_date,
// 							ack: true
// 						});
// 					});
// 					self.setObjectNotExists("WeekForecast.day5.ttn", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttn.name + " " + body.units.ttn.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day5.ttn", {val: body.sevendays[5].values[0].ttn, ack: true});
// 					});
// 					self.setObjectNotExists("WeekForecast.day5.smbd", {
// 						type: "state",
// 						common: {
// 							name: body.units.smbd.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day5.smbd", {val: body.sevendays[5].values[1].smbd, ack: true});
// 					});
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for weekforecast.day5");
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[5].values[1].smbd + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.sevendays[5].values[1].smbd);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("WeekForecast.day5.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name day5: " + this.icon);
// 						self.setState("WeekForecast.day5.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day5.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day5.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.sevendays[5].values[1].smbd + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day5.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day5.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day5.ttx", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttx.name + " " + body.units.ttx.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day5.ttx", {val: body.sevendays[5].values[2].ttx, ack: true});
// 					});
//
// 					//**********************
// 					//*** Day 6
// 					//**********************
// 					self.setObjectNotExists("WeekForecast.day6.formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day6.formatted_date", {
// 							val: body.sevendays[6].formatted_date,
// 							ack: true
// 						});
// 					});
// 					self.setObjectNotExists("WeekForecast.day6.ttn", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttn.name + " " + body.units.ttn.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day6.ttn", {val: body.sevendays[6].values[0].ttn, ack: true});
// 					});
// 					self.setObjectNotExists("WeekForecast.day6.smbd", {
// 						type: "state",
// 						common: {
// 							name: body.units.smbd.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day6.smbd", {val: body.sevendays[6].values[1].smbd, ack: true});
// 					});
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for weekforecast.day6");
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[6].values[1].smbd + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.sevendays[6].values[1].smbd);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("WeekForecast.day6.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name day6: " + this.icon);
// 						self.setState("WeekForecast.day6.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day6.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day6.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.sevendays[6].values[1].smbd + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day6.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day6.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("WeekForecast.day6.ttx", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttx.name + " " + body.units.ttx.unit,
// 							type: "string",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.day6.ttx", {val: body.sevendays[6].values[2].ttx, ack: true});
// 					});
//
// 					self.setObjectNotExists("WeekForecast.status", {
// 						type: "state",
// 						common: {
// 							name: "status",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.status", {val: "Success", ack: true});
// 					});
// 				});
// 				res.on("error", function (error) {
// 					self.log.error(error);
// 					self.setObjectNotExists("WeekForecast.status", {
// 						type: "state",
// 						common: {
// 							name: "status",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("WeekForecast.status", {val: error, ack: true});
// 					});
// 				});
// 			});
// 			reqWeekForecast.end();
//
// 			//********************************************************************************************
// 			//* Read Hour Forcast
// 			//********************************************************************************************
//
// 			//Options for getting hour forecast using Authorization Bearer
// 			var options_hour_forecast = {
// 				"method": "GET",
// 				"hostname": "api.srgssr.ch",
// 				"port": null,
// 				"path": "/forecasts/v1.0/weather/nexthour?latitude=" + latitude + "&longitude=" + longitude,
// 				"headers": {
// 					"authorization": "Bearer " + access_token
// 				}
// 			};
// 			var reqHourForecast = http.request(options_hour_forecast, function (res) {
// 				var chunks = [];
// 				res.on("data", function (chunk) {
// 					chunks.push(chunk);
// 				});
// 				res.on("end", function () {
// 					var body = JSON.parse(Buffer.concat(chunks).toString());
// 					self.log.debug("Hour Forecast: " + JSON.stringify(body));
//
// 					//Check for errors in response
// 					if (body.fault !== undefined) {
// 						self.log.error("Response has announced an error: " + body.fault.faultstring);
// 						if (body.fault.detail.errorcode.includes('InvalidAPICallAsNoApiProductMatchFound')){
// 							self.log.error("InvalidAPICallAsNoApiProductMatchFound: Wrong SRF-Product is linked to your SRF-App. Please choose the free SRF Product 'SRG-SSR-PUBLIC-API-V2'. Other SRF Prducts are not supported at the moment");
// 						}
// 						return;
// 					}
//
// 					if (body.code !== undefined) {
// 						self.log.debug("Hour Forecast - Return Code: " + body.code.toString());
// 						if (body.code.toString() === "404.02.001") {
// 							self.log.error("Hour Forecast - Requested Location is not supported. Please be aware, that this adapter only supports locations within Switzerland.");
// 							return;
// 						} else {
// 							self.log.error("Hour Forecast - An error has occured. " + JSON.stringify(body));
// 							return;
// 						}
// 					}
//
// 					//**********************
// 					//*** Formatted Date
// 					//**********************
// 					//Set Current Forecast Values
// 					self.setObjectNotExists("HourForecast." + "formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("HourForecast." + "formatted_date", {
// 							val: body.formatted_date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					//**********************
// 					//*** Next Hour
// 					//**********************
// 					if (Object.keys(body.nexthour).length > 0) {
// 						self.setObjectNotExists("HourForecast.nexthour.date", {
// 							type: "state",
// 							common: {
// 								name: "date",
// 								type: "string",
// 								role: "date"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.date", {
// 								val: body.nexthour[0].date.toString(),
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.smb3", {
// 							type: "state",
// 							common: {
// 								name: body.units.smb3.name,
// 								type: "string",
// 								role: "value"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.smb3", {
// 								val: body.nexthour[0].values[0].smb3,
// 								ack: true
// 							});
// 						});
//
// 						//read icon-name
// 						self.log.debug("get icon-url by xpath for hourforecast.nexthour");
// 						var gchild = xmlDoc.get("/root/row[Code=" + body.nexthour[0].values[0].smb3 + "]/Code_icon");
// 						if (gchild == undefined) {
// 							icon = "notavailable";
// 							self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.nexthour[0].values[0].smb3);
// 						} else {
// 							icon = gchild.text();
// 						}
// 						self.log.debug("Weather-Icon Name: " + icon);
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.icon-url", {
// 							type: "state",
// 							common: {
// 								name: "icon-url",
// 								type: "string",
// 								role: "weather.icon"
// 							},
// 							native: {},
// 						}, function () {
// 							self.log.debug("Weather-Icon Name nexthour: " + this.icon);
// 							self.setState("HourForecast.nexthour.values.icon-url", {
// 								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 								ack: true
// 							});
// 						}.bind({icon: icon}));
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.icon-url-srgssr", {
// 							type: "state",
// 							common: {
// 								name: "icon-url-srgssr",
// 								type: "string",
// 								role: "weather.icon"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.icon-url-srgssr", {
// 								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.nexthour[0].values[0].smb3 + ".png",
// 								ack: true
// 							});
// 						}.bind({icon: icon}));
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.icon-name", {
// 							type: "state",
// 							common: {
// 								name: "icon-name",
// 								type: "string",
// 								role: "weather.icon"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.icon-name", {
// 								val: this.icon + ".png",
// 								ack: true
// 							});
// 						}.bind({icon: icon}));
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.ttt", {
// 							type: "state",
// 							common: {
// 								name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 								type: "number",
// 								role: "value.temperature"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.ttt", {
// 								val: body.nexthour[0].values[1].ttt,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.fff", {
// 							type: "state",
// 							common: {
// 								name: body.units.fff.name + " in " + body.units.fff.unit,
// 								type: "number",
// 								role: "value.temperature"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.fff", {
// 								val: body.nexthour[0].values[2].fff,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.ffx3", {
// 							type: "state",
// 							common: {
// 								name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 								type: "number",
// 								role: "value.temperature"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.ffx3", {
// 								val: body.nexthour[0].values[3].ffx3,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.ddd", {
// 							type: "state",
// 							common: {
// 								name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 								type: "number",
// 								role: "value"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.ddd", {
// 								val: body.nexthour[0].values[4].ddd,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.rr3", {
// 							type: "state",
// 							common: {
// 								name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 								type: "number",
// 								role: "value"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.rr3", {
// 								val: body.nexthour[0].values[5].rr3,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("HourForecast.nexthour.values.pr3", {
// 							type: "state",
// 							common: {
// 								name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 								type: "number",
// 								role: "value"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.nexthour.values.pr3", {
// 								val: body.nexthour[0].values[6].pr3,
// 								ack: true
// 							});
// 						});
//
// 						self.setObjectNotExists("HourForecast.status", {
// 							type: "state",
// 							common: {
// 								name: "status",
// 								type: "string",
// 								role: "text"
// 							},
// 							native: {},
// 						}, function () {
// 							self.setState("HourForecast.status", {val: "Success", ack: true});
// 						});
//
// 					} else {
// 						self.log.warn("Hour Forecast - nexthour is empty. Do no import for this cycle")
// 					}
// 				});
// 				res.on("error", function (error) {
// 					self.log.error(error);
//
// 					self.setObjectNotExists("HourForecast.status", {
// 						type: "state",
// 						common: {
// 							name: "status",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("HourForecast.status", {val: error, ack: true});
// 					});
// 				});
// 			});
// 			reqHourForecast.end();
//
// 			//********************************************************************************************
// 			//* Read 24h Forcast
// 			//********************************************************************************************
//
// 			//Options for getting 24h forecast using Authorization Bearer
// 			var options_24h_forecast = {
// 				"method": "GET",
// 				"hostname": "api.srgssr.ch",
// 				"port": null,
// 				"path": "/forecasts/v1.0/weather/24hour?latitude=" + latitude + "&longitude=" + longitude,
// 				"headers": {
// 					"authorization": "Bearer " + access_token
// 				}
// 			};
// 			var req24hForecast = http.request(options_24h_forecast, function (res) {
// 				var chunks = [];
// 				res.on("data", function (chunk) {
// 					chunks.push(chunk);
// 				});
// 				res.on("end", function () {
// 					var chunksConcat = Buffer.concat(chunks).toString();
// 					chunksConcat = chunksConcat.replace(/24hours/g, "twentyfourhours");
// 					self.log.debug("chunksConcat: " + chunksConcat);
// 					var body = JSON.parse(chunksConcat);
// 					self.log.debug("24h Forecast: " + JSON.stringify(body));
//
// 					//Check for errors in response
// 					if (body.fault !== undefined) {
// 						self.log.error("Response has announced an error: " + body.fault.faultstring);
// 						if (body.fault.detail.errorcode.includes('InvalidAPICallAsNoApiProductMatchFound')){
// 							self.log.error("InvalidAPICallAsNoApiProductMatchFound: Wrong SRF-Product is linked to your SRF-App. Please choose the free SRF Product 'SRG-SSR-PUBLIC-API-V2'. Other SRF Prducts are not supported at the moment");
// 						}
// 						return;
// 					}
//
// 					if (body.code !== undefined) {
// 						self.log.debug("24h Forecast - Return Code: " + body.code.toString());
// 						if (body.code.toString() === "404.02.001") {
// 							self.log.error("24h Forecast - Requested Location is not supported. Please be aware, that this adapter only supports locations within Switzerland.");
// 							return;
// 						} else {
// 							self.log.error("24h Forecast - An error has occured. " + JSON.stringify(body));
// 							return;
// 						}
// 					}
//
// 					//**********************
// 					//*** Formatted Date
// 					//**********************
// 					self.setObjectNotExists("24hForecast.formatted_date", {
// 						type: "state",
// 						common: {
// 							name: "formatted_date",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.formatted_date", {
// 							val: body.formatted_date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					//************************
// 					//*** 24h Hours - hour 0
// 					//************************
// 					self.setObjectNotExists("24hForecast.hour0.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.date", {
// 							val: body.twentyfourhours[0].date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour0.values.smb3", {
// 						type: "state",
// 						common: {
// 							name: body.units.smb3.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.smb3", {
// 							val: body.twentyfourhours[0].values[0].smb3,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for 24h forecast.hour0: " + body.twentyfourhours[0].values[0].smb3);
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[0].values[0].smb3 + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.twentyfourhours[0].values[0].smb3);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("24hForecast.hour0.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour0: " + this.icon);
// 						self.setState("24hForecast.hour0.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour0.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.twentyfourhours[0].values[0].smb3 + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour0.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour0.values.ttt", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.ttt", {
// 							val: body.twentyfourhours[0].values[1].ttt,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour0.values.fff", {
// 						type: "state",
// 						common: {
// 							name: body.units.fff.name + " in " + body.units.fff.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.fff", {
// 							val: body.twentyfourhours[0].values[2].fff,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour0.values.ffx3", {
// 						type: "state",
// 						common: {
// 							name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.ffx3", {
// 							val: body.twentyfourhours[0].values[3].ffx3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour0.values.ddd", {
// 						type: "state",
// 						common: {
// 							name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.ddd", {
// 							val: body.twentyfourhours[0].values[4].ddd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour0.values.rr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.rr3", {
// 							val: body.twentyfourhours[0].values[5].rr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour0.values.pr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour0.values.pr3", {
// 							val: body.twentyfourhours[0].values[6].pr3,
// 							ack: true
// 						});
// 					});
//
// 					//************************
// 					//*** 24h Hours - hour 1
// 					//************************
// 					self.setObjectNotExists("24hForecast.hour1.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.date", {
// 							val: body.twentyfourhours[1].date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour1.values.smb3", {
// 						type: "state",
// 						common: {
// 							name: body.units.smb3.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.smb3", {
// 							val: body.twentyfourhours[1].values[0].smb3,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for 24h forecast.hour1: " + body.twentyfourhours[1].values[0].smb3);
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[1].values[0].smb3 + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.twentyfourhours[1].values[0].smb3);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("24hForecast.hour1.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour1: " + this.icon);
// 						self.setState("24hForecast.hour1.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour1.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.twentyfourhours[1].values[0].smb3 + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour1.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour1.values.ttt", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.ttt", {
// 							val: body.twentyfourhours[1].values[1].ttt,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour1.values.fff", {
// 						type: "state",
// 						common: {
// 							name: body.units.fff.name + " in " + body.units.fff.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.fff", {
// 							val: body.twentyfourhours[1].values[2].fff,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour1.values.ffx3", {
// 						type: "state",
// 						common: {
// 							name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.ffx3", {
// 							val: body.twentyfourhours[1].values[3].ffx3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour1.values.ddd", {
// 						type: "state",
// 						common: {
// 							name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.ddd", {
// 							val: body.twentyfourhours[1].values[4].ddd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour1.values.rr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.rr3", {
// 							val: body.twentyfourhours[1].values[5].rr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour1.values.pr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour1.values.pr3", {
// 							val: body.twentyfourhours[1].values[6].pr3,
// 							ack: true
// 						});
// 					});
//
// 					//************************
// 					//*** 24h Hours - hour 2
// 					//************************
// 					self.setObjectNotExists("24hForecast.hour2.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.date", {
// 							val: body.twentyfourhours[2].date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour2.values.smb3", {
// 						type: "state",
// 						common: {
// 							name: body.units.smb3.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.smb3", {
// 							val: body.twentyfourhours[2].values[0].smb3,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for 24h forecast.hour2: " + body.twentyfourhours[2].values[0].smb3);
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[2].values[0].smb3 + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.twentyfourhours[2].values[0].smb3);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("24hForecast.hour2.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour2: " + this.icon);
// 						self.setState("24hForecast.hour2.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour2.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.twentyfourhours[2].values[0].smb3 + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour2.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour2.values.ttt", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.ttt", {
// 							val: body.twentyfourhours[2].values[1].ttt,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour2.values.fff", {
// 						type: "state",
// 						common: {
// 							name: body.units.fff.name + " in " + body.units.fff.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.fff", {
// 							val: body.twentyfourhours[2].values[2].fff,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour2.values.ffx3", {
// 						type: "state",
// 						common: {
// 							name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.ffx3", {
// 							val: body.twentyfourhours[2].values[3].ffx3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour2.values.ddd", {
// 						type: "state",
// 						common: {
// 							name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.ddd", {
// 							val: body.twentyfourhours[2].values[4].ddd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour2.values.rr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.rr3", {
// 							val: body.twentyfourhours[2].values[5].rr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour2.values.pr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour2.values.pr3", {
// 							val: body.twentyfourhours[2].values[6].pr3,
// 							ack: true
// 						});
// 					});
//
// 					//************************
// 					//*** 24h Hours - hour 3
// 					//************************
// 					self.setObjectNotExists("24hForecast.hour3.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.date", {
// 							val: body.twentyfourhours[3].date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour3.values.smb3", {
// 						type: "state",
// 						common: {
// 							name: body.units.smb3.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.smb3", {
// 							val: body.twentyfourhours[3].values[0].smb3,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for 24h forecast.hour3: " + body.twentyfourhours[3].values[0].smb3);
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[3].values[0].smb3 + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.twentyfourhours[3].values[0].smb3);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("24hForecast.hour3.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour3: " + this.icon);
// 						self.setState("24hForecast.hour3.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour3.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.twentyfourhours[3].values[0].smb3 + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour3.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour3.values.ttt", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.ttt", {
// 							val: body.twentyfourhours[3].values[1].ttt,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour3.values.fff", {
// 						type: "state",
// 						common: {
// 							name: body.units.fff.name + " in " + body.units.fff.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.fff", {
// 							val: body.twentyfourhours[3].values[2].fff,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour3.values.ffx3", {
// 						type: "state",
// 						common: {
// 							name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.ffx3", {
// 							val: body.twentyfourhours[3].values[3].ffx3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour3.values.ddd", {
// 						type: "state",
// 						common: {
// 							name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.ddd", {
// 							val: body.twentyfourhours[3].values[4].ddd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour3.values.rr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.rr3", {
// 							val: body.twentyfourhours[3].values[5].rr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour3.values.pr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour3.values.pr3", {
// 							val: body.twentyfourhours[3].values[6].pr3,
// 							ack: true
// 						});
// 					});
//
// 					//************************
// 					//*** 24h Hours - hour 4
// 					//************************
// 					self.setObjectNotExists("24hForecast.hour4.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.date", {
// 							val: body.twentyfourhours[4].date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour4.values.smb3", {
// 						type: "state",
// 						common: {
// 							name: body.units.smb3.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.smb3", {
// 							val: body.twentyfourhours[4].values[0].smb3,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for 24h forecast.hour4: " + body.twentyfourhours[4].values[0].smb3);
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[4].values[0].smb3 + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.twentyfourhours[4].values[0].smb3);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("24hForecast.hour4.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour4: " + this.icon);
// 						self.setState("24hForecast.hour4.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour4.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.twentyfourhours[4].values[0].smb3 + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour4.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour4.values.ttt", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.ttt", {
// 							val: body.twentyfourhours[4].values[1].ttt,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour4.values.fff", {
// 						type: "state",
// 						common: {
// 							name: body.units.fff.name + " in " + body.units.fff.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.fff", {
// 							val: body.twentyfourhours[4].values[2].fff,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour4.values.ffx3", {
// 						type: "state",
// 						common: {
// 							name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.ffx3", {
// 							val: body.twentyfourhours[4].values[3].ffx3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour4.values.ddd", {
// 						type: "state",
// 						common: {
// 							name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.ddd", {
// 							val: body.twentyfourhours[4].values[4].ddd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour4.values.rr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.rr3", {
// 							val: body.twentyfourhours[4].values[5].rr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour4.values.pr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour4.values.pr3", {
// 							val: body.twentyfourhours[4].values[6].pr3,
// 							ack: true
// 						});
// 					});
//
// 					//************************
// 					//*** 24h Hours - hour 5
// 					//************************
// 					self.setObjectNotExists("24hForecast.hour5.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.date", {
// 							val: body.twentyfourhours[5].date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour5.values.smb3", {
// 						type: "state",
// 						common: {
// 							name: body.units.smb3.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.values.smb3", {
// 							val: body.twentyfourhours[5].values[0].smb3,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for 24h forecast.hour5: " + body.twentyfourhours[5].values[0].smb3);
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[5].values[0].smb3 + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.twentyfourhours[5].values[0].smb3);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("24hForecast.hour5.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour5: " + this.icon);
// 						self.setState("24hForecast.hour5.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour5.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour5: " + this.icon);
// 						self.setState("24hForecast.hour5.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.twentyfourhours[5].values[0].smb3 + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour5.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.values.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour5.values.ttt", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.values.ttt", {
// 							val: body.twentyfourhours[5].values[1].ttt,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour5.values.fff", {
// 						type: "state",
// 						common: {
// 							name: body.units.fff.name + " in " + body.units.fff.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.values.fff", {
// 							val: body.twentyfourhours[5].values[2].fff,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour5.values.ffx3", {
// 						type: "state",
// 						common: {
// 							name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.values.ffx3", {
// 							val: body.twentyfourhours[5].values[3].ffx3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour5.values.ddd", {
// 						type: "state",
// 						common: {
// 							name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.values.ddd", {
// 							val: body.twentyfourhours[5].values[4].ddd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour5.values.rr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.values.rr3", {
// 							val: body.twentyfourhours[5].values[5].rr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour5.values.pr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour5.values.pr3", {
// 							val: body.twentyfourhours[5].values[6].pr3,
// 							ack: true
// 						});
// 					});
//
// 					//************************
// 					//*** 24h Hours - hour 6
// 					//************************
// 					self.setObjectNotExists("24hForecast.hour6.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.date", {
// 							val: body.twentyfourhours[6].date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour6.values.smb3", {
// 						type: "state",
// 						common: {
// 							name: body.units.smb3.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.smb3", {
// 							val: body.twentyfourhours[6].values[0].smb3,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for 24h forecast.hour6: " + body.twentyfourhours[6].values[0].smb3);
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[6].values[0].smb3 + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.twentyfourhours[6].values[0].smb3);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("24hForecast.hour6.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour6: " + this.icon);
// 						self.setState("24hForecast.hour6.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour6.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.twentyfourhours[6].values[0].smb3 + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour6.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour6.values.ttt", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.ttt", {
// 							val: body.twentyfourhours[6].values[1].ttt,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour6.values.fff", {
// 						type: "state",
// 						common: {
// 							name: body.units.fff.name + " in " + body.units.fff.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.fff", {
// 							val: body.twentyfourhours[6].values[2].fff,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour6.values.ffx3", {
// 						type: "state",
// 						common: {
// 							name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.ffx3", {
// 							val: body.twentyfourhours[6].values[3].ffx3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour6.values.ddd", {
// 						type: "state",
// 						common: {
// 							name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.ddd", {
// 							val: body.twentyfourhours[6].values[4].ddd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour6.values.rr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.rr3", {
// 							val: body.twentyfourhours[6].values[5].rr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour6.values.pr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour6.values.pr3", {
// 							val: body.twentyfourhours[6].values[6].pr3,
// 							ack: true
// 						});
// 					});
//
// 					//************************
// 					//*** 24h Hours - hour 7
// 					//************************
// 					self.setObjectNotExists("24hForecast.hour7.date", {
// 						type: "state",
// 						common: {
// 							name: "date",
// 							type: "string",
// 							role: "date"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.date", {
// 							val: body.twentyfourhours[7].date.toString(),
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour7.values.smb3", {
// 						type: "state",
// 						common: {
// 							name: body.units.smb3.name,
// 							type: "string",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.smb3", {
// 							val: body.twentyfourhours[7].values[0].smb3,
// 							ack: true
// 						});
// 					});
//
// 					//read icon-name
// 					self.log.debug("get icon-url by xpath for 24h forecast.hour7: " + body.twentyfourhours[7].values[0].smb3);
// 					var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[7].values[0].smb3 + "]/Code_icon");
// 					if (gchild == undefined) {
// 						icon = "notavailable";
// 						self.log.info("Icon could not be found. Please create an issue on github. Icon number was: " + body.twentyfourhours[7].values[0].smb3);
// 					} else {
// 						icon = gchild.text();
// 					}
// 					self.log.debug("Weather-Icon Name: " + icon);
//
// 					self.setObjectNotExists("24hForecast.hour7.values.icon-url", {
// 						type: "state",
// 						common: {
// 							name: "icon-url",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.log.debug("Weather-Icon Name hour7: " + this.icon);
// 						self.setState("24hForecast.hour7.values.icon-url", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/" + this.icon + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour7.values.icon-url-srgssr", {
// 						type: "state",
// 						common: {
// 							name: "icon-url-srgssr",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.icon-url-srgssr", {
// 							val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/srgssr/" + body.twentyfourhours[7].values[0].smb3 + ".png",
// 							ack: true
// 						});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour7.values.icon-name", {
// 						type: "state",
// 						common: {
// 							name: "icon-name",
// 							type: "string",
// 							role: "weather.icon"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.icon-name", {val: this.icon + ".png", ack: true});
// 					}.bind({icon: icon}));
//
// 					self.setObjectNotExists("24hForecast.hour7.values.ttt", {
// 						type: "state",
// 						common: {
// 							name: body.units.ttt.name + " in " + body.units.ttt.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.ttt", {
// 							val: body.twentyfourhours[7].values[1].ttt,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour7.values.fff", {
// 						type: "state",
// 						common: {
// 							name: body.units.fff.name + " in " + body.units.fff.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.fff", {
// 							val: body.twentyfourhours[7].values[2].fff,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour7.values.ffx3", {
// 						type: "state",
// 						common: {
// 							name: body.units.ffx3.name + " in " + body.units.ffx3.unit,
// 							type: "number",
// 							role: "value.temperature"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.ffx3", {
// 							val: body.twentyfourhours[7].values[3].ffx3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour7.values.ddd", {
// 						type: "state",
// 						common: {
// 							name: body.units.ddd.name + " in " + body.units.ddd.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.ddd", {
// 							val: body.twentyfourhours[7].values[4].ddd,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour7.values.rr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.rr3.name + " in " + body.units.rr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.rr3", {
// 							val: body.twentyfourhours[7].values[5].rr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.hour7.values.pr3", {
// 						type: "state",
// 						common: {
// 							name: body.units.pr3.name + " in " + body.units.pr3.unit,
// 							type: "number",
// 							role: "value"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.hour7.values.pr3", {
// 							val: body.twentyfourhours[7].values[6].pr3,
// 							ack: true
// 						});
// 					});
//
// 					self.setObjectNotExists("24hForecast.status", {
// 						type: "state",
// 						common: {
// 							name: "status",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.status", {val: "success", ack: true});
// 					});
// 				});
//
// 				res.on("error", function (error) {
// 					self.log.error(error);
// 					self.setObjectNotExists("24hForecast.status", {
// 						type: "state",
// 						common: {
// 							name: "status",
// 							type: "string",
// 							role: "text"
// 						},
// 						native: {},
// 					}, function () {
// 						self.setState("24hForecast.status", {val: error, ack: true});
// 					});
// 				});
// 			});
// 			req24hForecast.end();
// 		});
// 		res.on("error", function (error) {
// 			self.log.error(error)
// 		});
// 	});
// 	req.end();
// 	setTimeout(doIt, pollInterval, self);
// }

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