"use strict";

/*
 * Created with @iobroker/create-adapter v1.18.0
 */
const utils = require("@iobroker/adapter-core");
const { http, https } = require('follow-redirects');
var timeout;

const datesAreOnSameDay = (first, second) =>
	first.getFullYear() === second.getFullYear() &&
	first.getMonth() === second.getMonth() &&
	first.getDate() === second.getDate();

function getActualDateFormattet(actualDate) {
	var	year = (actualDate.getFullYear());
	var month = (actualDate.getMonth()<10?'0':'') + actualDate.getMonth();
	var day = (actualDate.getDate()<10?'0':'') + actualDate.getDate();
	return year + "-" + month + "-" + day;
}

function getTimeFormattet(actualDate) {
	var	hour = (actualDate.getHours()<10?'0':'') + actualDate.getHours();
	var min = (actualDate.getMinutes()<10?'0':'') + actualDate.getMinutes();
	var sec = (actualDate.getSeconds()<10?'0':'') + actualDate.getSeconds();
	return hour + ":" + min + ":" + sec;
}

// @ts-ignore
Date.prototype.addDays = function(days) {
	var date = new Date(this.valueOf());
	date.setDate(date.getDate() + days);
	return date;
}

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
		getSystemData(this); // read Longitude und Latitude
		setTimeout(doIt, 10000, this); // First start after 10s
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

function doIt(self) {
	process.on('uncaughtException', function(err) {
		self.log.error("Allgemeiner Fehler " + err.message);
	});
	// First get Access Token
	var access_token;
	//Convert ConsumerKey and ConsumerSecret to base64
	let data = self.config.ConsumerKey + ":" + self.config.ConsumerSecret;
	var pollInterval = self.config.PollInterval * 60000; //Convert minute to miliseconds
	let buff = Buffer.from(data);
	let base64data = buff.toString('base64');
	self.log.debug('"' + data + '" converted to Base64 is "' + base64data + '"');
	var today = new Date();
	// @ts-ignore
	var today1 = new Date().addDays(1);
	// @ts-ignore
	var today2 = new Date().addDays(2);
	// @ts-ignore
	var today3 = new Date().addDays(3);
	// @ts-ignore
	var today4 = new Date().addDays(4);
	// @ts-ignore
	var today5 = new Date().addDays(5);
	// @ts-ignore
	var today6 = new Date().addDays(6);
	// @ts-ignore
	var today7 = new Date().addDays(7);

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

	self.log.debug("Options to get Access Token: " + JSON.stringify(options_Access_Token));

	var req = https.request(options_Access_Token, function (res) {
		var chunks = [];
		res.on("data", function (chunk) {
			chunks.push(chunk);
		});
		res.on("end", function () {
			self.log.debug("Answer of Request Access Token: " + Buffer.concat(chunks).toString());
			var body = JSON.parse(Buffer.concat(chunks).toString());
			if (body.access_token === undefined) {
				self.log.warn("Got no Token - Is Adapter correctly configured (ConsumerKey/ConsumerSecret)? It may also be that the maximum number of queries for today is exhausted");
				return;
			} else if (body.access_token == ""){
				self.log.warn("Got an empty Token - It may be that the maximum number of queries for today is exhausted");
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
				"path": "/srf-meteo/geolocations?latitude=" + self.config.Latitude + "&longitude=" + self.config.Longitude,
				"headers": {
					"authorization": "Bearer " + access_token
				}
			};

			self.log.debug("Options to get GeolocationId: " + JSON.stringify(options_geolocationId));

			//set request
			var req = https.request(options_geolocationId, function (res) {
				var chunks = [];
				res.on("data", function (chunk) {
					chunks.push(chunk);
				});
				res.on("end", function () {
					self.log.debug("Answer of getGeolocation Request: " + Buffer.concat(chunks).toString());
					var body = JSON.parse(Buffer.concat(chunks).toString());
					self.log.debug("Body: " + JSON.stringify(body));

					//check if there is a Error-Code
					if (body.hasOwnProperty("code")) {
						self.log.debug("Return Code: " + body.code.toString());
						if (body.code.toString().startsWith("404")) {
							self.log.error("Get Gelocation id - Resource not found");
							return;
						} else if (body.code.toString().startsWith("400")){
							self.log.error("Get Gelocation id -  Invalid request");
							self.log.error("Get Gelocation id  - An error has occured. " + JSON.stringify(body));
							return;
						} else if (body.code.toString().startsWith("401")){
							self.log.error("Get Gelocation id -  Invalid or expired access token ");
							self.log.error("Get Gelocation id  - An error has occured. " + JSON.stringify(body));
							return;
						} else if (body.code.toString().startsWith("429")) {
							self.log.error("Get Gelocation id -  Invalid or expired access token ");
							self.log.error("Get Gelocation id  - An error has occured. " + JSON.stringify(body));
							return;
						} else {
							self.log.error("Get Gelocation id - An error has occured. " + JSON.stringify(body));
							return;
						}
					}

					//Extract GeolocationID
					var geolocationId = body[0].id.toString();

					//Now get forecast
					//Options for getting forecast
					var options_forecast = {
						"method": "GET",
						"hostname": "api.srgssr.ch",
						"port": null,
						"path": "/srf-meteo/forecast/"+geolocationId,
						"headers": {
							"authorization": "Bearer " + access_token
						}
					};

					self.log.debug("Options to get forecast: " + JSON.stringify(options_forecast));
					self.log.info("Getting forecast for GeolocationId: " + geolocationId);

					//set request
					var req = https.request(options_forecast, function (res) {
						var chunks = [];
						res.on("data", function (chunk) {
							chunks.push(chunk);
						});
						res.on("end", function () {
							self.log.debug("Answer of forecast Request: " + Buffer.concat(chunks).toString());
							var body = JSON.parse(Buffer.concat(chunks).toString());

							//check if there is a Error-Code
							if (body.hasOwnProperty("code")) {
								self.log.debug("Return Code: " + body.code.toString());
								if (body.code.toString().startsWith("404")) {
									self.log.error("Forecast - Resource not found");
									return;
								} else if (body.code.toString().startsWith("400")){
									self.log.error("Forecast -  Invalid request");
									self.log.error("Forecast  - An error has occured. " + JSON.stringify(body));
									return;
								} else if (body.code.toString().startsWith("401")){
									self.log.error("Forecast -  Invalid or expired access token ");
									self.log.error("Forecast  - An error has occured. " + JSON.stringify(body));
									return;
								} else if (body.code.toString().startsWith("429")) {
									self.log.error("Forecast -  Invalid or expired access token ");
									self.log.error("Forecast  - An error has occured. " + JSON.stringify(body));
									return;
								} else {
									self.log.error("Forecast - An error has occured. " + JSON.stringify(body));
									return;
								}
							}

							//**************************************
							//*** Start extract forcast informations
							//**************************************

							//*** geolocation informations ***
							self.setObjectNotExists("geolocation." + "id", {
								type: "state",
								common: {
									name: "id",
									type: "string",
									role: "text"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "id", {
									val: body.geolocation.id.toString(),
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "lat", {
								type: "state",
								common: {
									name: "latitude",
									type: "number",
									role: "value.gps.latitude",
									write: false
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "lat", {
									val: body.geolocation.lat,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "lon", {
								type: "state",
								common: {
									name: "longitude",
									type: "number",
									role: "value.gps.longitude",
									write: false
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "lon", {
									val: body.geolocation.lon,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "station_id", {
								type: "state",
								common: {
									name: "station id",
									type: "string",
									role: "text",
									write: false
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "station_id", {
									val: body.geolocation.station_id,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "timezone", {
								type: "state",
								common: {
									name: "timezone",
									type: "string",
									role: "text",
									write: false
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "timezone", {
									val: body.geolocation.timezone,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "default_name", {
								type: "state",
								common: {
									name: "default name",
									type: "string",
									role: "text",
									write: false
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "default_name", {
									val: body.geolocation.default_name,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "alarm_region_id", {
								type: "state",
								common: {
									name: "alarm region id",
									type: "string",
									role: "text",
									write: false
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "alarm_region_id", {
									val: body.geolocation.alarm_region_id,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "alarm_region_name", {
								type: "state",
								common: {
									name: "alarm region name",
									type: "string",
									role: "text",
									write: false
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "alarm_region_name", {
									val: body.geolocation.alarm_region_name,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "district", {
								type: "state",
								common: {
									name: "district",
									type: "string",
									role: "text",
									write: false
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "district", {
									val: body.geolocation.district,
									ack: true
								});
							});

							//Geolocation_Names
							self.setObjectNotExists("geolocation." + "geolocation_names." + "district", {
								type: "state",
								common: {
									name: "district",
									type: "string",
									role: "location"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "district", {
									val: body.geolocation.geolocation_names[0].district,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "id", {
								type: "state",
								common: {
									name: "id",
									type: "string",
									role: "text"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "id", {
									val: body.geolocation.geolocation_names[0].id,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "type", {
								type: "state",
								common: {
									name: "City or POI (Point of Interest)",
									type: "string",
									role: "text"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "type", {
									val: body.geolocation.geolocation_names[0].type,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "language", {
								type: "state",
								common: {
									name: "language",
									type: "number",
									role: "value"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "language", {
									val: body.geolocation.geolocation_names[0].language,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "translation_type", {
								type: "state",
								common: {
									name: "translation type",
									type: "string",
									role: "text"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "translation_type", {
									val: body.geolocation.geolocation_names[0].translation_type,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "name", {
								type: "state",
								common: {
									name: "name",
									type: "string",
									role: "text"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "name", {
									val: body.geolocation.geolocation_names[0].name,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "country", {
								type: "state",
								common: {
									name: "country",
									type: "string",
									role: "text"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "country", {
									val: body.geolocation.geolocation_names[0].country,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "province", {
								type: "state",
								common: {
									name: "province",
									type: "string",
									role: "text"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "province", {
									val: body.geolocation.geolocation_names[0].province,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "inhabitants", {
								type: "state",
								common: {
									name: "inhabitants",
									type: "number",
									role: "value"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "inhabitants", {
									val: body.geolocation.geolocation_names[0].inhabitants,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "height", {
								type: "state",
								common: {
									name: "height",
									type: "number",
									role: "value"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "height", {
									val: body.geolocation.geolocation_names[0].height,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "plz", {
								type: "state",
								common: {
									name: "plz",
									type: "number",
									role: "value"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "plz", {
									val: body.geolocation.geolocation_names[0].plz,
									ack: true
								});
							});
							self.setObjectNotExists("geolocation." + "geolocation_names." + "ch", {
								type: "state",
								common: {
									name: "ch",
									type: "number",
									role: "value"
								},
								native: {},
							}, function () {
								self.setState("geolocation." + "geolocation_names." + "ch", {
									val: body.geolocation.geolocation_names[0].ch,
									ack: true
								});
							});

							//*** Create 60minutes forecast ***
							self.setObjectNotExists("forecast." + "60minutes", {
								type: "channel",
								common: {
									name: "Forecast data for time windows of 60 minutes (for 98 hours from today 0:00)",
									role: "info"
								},
								native: {},
							});
							// Day 0
							self.setObjectNotExists("forecast." + "60minutes.day0", {
								type: "channel",
								common: {
									name: "Forecast data for today",
									role: "info"
								},
								native: {},
							});
							// Day 1
							self.setObjectNotExists("forecast." + "60minutes.day1", {
								type: "channel",
								common: {
									name: "Forecast data for tomorrow",
									role: "info"
								},
								native: {},
							});
							// Day 2
							self.setObjectNotExists("forecast." + "60minutes.day2", {
								type: "channel",
								common: {
									name: "Forecast data for today + 2 days",
									role: "info"
								},
								native: {},
							});
							// Day 3
							self.setObjectNotExists("forecast." + "60minutes.day3", {
								type: "channel",
								common: {
									name: "Forecast data for today + 3 days",
									role: "info"
								},
								native: {},
							});
							// Day 4
							self.setObjectNotExists("forecast." + "60minutes.day4", {
								type: "channel",
								common: {
									name: "Forecast data for today + 4 days",
									role: "info"
								},
								native: {},
							});


							//iterate over all 60minutes objects
							body.forecast["60minutes"].forEach(function(obj,index) {
								var startTimeISOString = obj.local_date_time;
								var objDate = new Date(startTimeISOString);
								var myPath;
								var myTime =  getTimeFormattet(objDate);

								if (datesAreOnSameDay(today, objDate)) {
									myPath = "day0";
								} else if (datesAreOnSameDay(today1, objDate)) {
									myPath = "day1";
								} else if (datesAreOnSameDay(today2, objDate)) {
									myPath = "day2";
								} else if (datesAreOnSameDay(today3, objDate)) {
									myPath = "day3";
								} else if (datesAreOnSameDay(today4, objDate)) {
									myPath = "day4";
								} else if (datesAreOnSameDay(today5, objDate)) {
									myPath = "day5";
								} else {
									self.log.error("invalid date found. Could not assign date. The date received is not one of the coming week. " + startTimeISOString);
									return;
								}

								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "local_date_time", {
									type: "state",
									common: {
										name: "Date for validity of record",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "local_date_time", {
										val: obj.local_date_time,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "TTT_C", {
									type: "state",
									common: {
										name: "Current temperature in °C",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "TTT_C", {
										val: obj.TTT_C,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "TTL_C", {
									type: "state",
									common: {
										name: "Error range lower limit",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "TTL_C", {
										val: obj.TTL_C,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "TTH_C", {
									type: "state",
									common: {
										name: "Error range upper limit",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "TTH_C", {
										val: obj.TTH_C,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "PROBPCP_PERCENT", {
									type: "state",
									common: {
										name: "Probability of precipitation in %",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "PROBPCP_PERCENT", {
										val: obj.PROBPCP_PERCENT,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "RRR_MM", {
									type: "state",
									common: {
										name: "Precipitation total",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "RRR_MM", {
										val: obj.RRR_MM,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "FF_KMH", {
									type: "state",
									common: {
										name: "Wind speed in km/h",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "FF_KMH", {
										val: obj.FF_KMH,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "FX_KMH", {
									type: "state",
									common: {
										name: "Peak wind speed in km/h",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "FX_KMH", {
										val: obj.FX_KMH,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "DD_DEG", {
									type: "state",
									common: {
										name: "Wind direction in angular degrees: 0 = North wind",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "DD_DEG", {
										val: obj.DD_DEG,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "SYMBOL_CODE", {
									type: "state",
									common: {
										name: "Mapping to weather icon",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "SYMBOL_CODE", {
										val: obj.SYMBOL_CODE,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "ICON_URL_COLOR", {
									type: "state",
									common: {
										name: "URL to color Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "ICON_URL_COLOR", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Color/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "ICON_URL_DARK", {
									type: "state",
									common: {
										name: "URL to dark Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "ICON_URL_DARK", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Dark/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "ICON_URL_LIGHT", {
									type: "state",
									common: {
										name: "URL to light Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "ICON_URL_LIGHT", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Light/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});

								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "type", {
									type: "state",
									common: {
										name: "result set; possible values: 60minutes, hour, day",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "type", {
										val: obj.type,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "cur_color", {
									type: "channel",
									common: {
										name: "Mapping temperature / color value",
										role: "info"
									},
									native: {},
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "cur_color." + "temperature", {
									type: "state",
									common: {
										name: "Temperature value",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "cur_color." + "temperature", {
										val: obj.cur_color.temperature,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "cur_color." + "background_color", {
									type: "state",
									common: {
										name: "background hex color value",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "cur_color." + "background_color", {
										val: obj.cur_color.background_color,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "60minutes." + myPath +"." + myTime +"." + "cur_color." + "text_color", {
									type: "state",
									common: {
										name: "text hex color value",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "60minutes." + myPath +"." + myTime +"." + "cur_color." + "text_color", {
										val: obj.cur_color.text_color,
										ack: true
									});
								});
							});

							//*** Create day forecast ***
							self.setObjectNotExists("forecast." + "day", {
								type: "channel",
								common: {
									name: "Forecast data for a whole day (for 8 days from today 0:00 )",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "day.day0", {
								type: "channel",
								common: {
									name: "Forecast data for today",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "day.day1", {
								type: "channel",
								common: {
									name: "Forecast data for tomorrow",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "day.day2", {
								type: "channel",
								common: {
									name: "Forecast data for today + 2 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "day.day3", {
								type: "channel",
								common: {
									name: "Forecast data for today + 3 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "day.day4", {
								type: "channel",
								common: {
									name: "Forecast data for today + 4 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "day.day5", {
								type: "channel",
								common: {
									name: "Forecast data for today + 5 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "day.day6", {
								type: "channel",
								common: {
									name: "Forecast data for today + 6 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "day.day7", {
								type: "channel",
								common: {
									name: "Forecast data for today + 7 days",
									role: "info"
								},
								native: {},
							});

							// iterate over all day objects
							body.forecast["day"].forEach(function(obj,index) {
								var startTimeISOString = obj.local_date_time;
								var objDate = new Date(startTimeISOString);
								var myPath;
								var myTime =  getTimeFormattet(objDate);

								if (datesAreOnSameDay(today, objDate)) {
									myPath = "day0";
								} else if (datesAreOnSameDay(today1, objDate)) {
									myPath = "day1";
								} else if (datesAreOnSameDay(today2, objDate)) {
									myPath = "day2";
								} else if (datesAreOnSameDay(today3, objDate)) {
									myPath = "day3";
								} else if (datesAreOnSameDay(today4, objDate)) {
									myPath = "day4";
								} else if (datesAreOnSameDay(today5, objDate)) {
									myPath = "day5";
								} else if (datesAreOnSameDay(today6, objDate)) {
									myPath = "day6";
								} else if (datesAreOnSameDay(today7, objDate)) {
									myPath = "day7";
								} else {
									self.log.error("invalid date found. Could not assign date. The date received is not one of the coming week. " + startTimeISOString);
									return;
								}

								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "local_date_time", {
									type: "state",
									common: {
										name: "Date for validity of record",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "local_date_time", {
										val: obj.local_date_time,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "TX_C", {
									type: "state",
									common: {
										name: "Maximum temperature in °C",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "TX_C", {
										val: obj.TX_C,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "TN_C", {
									type: "state",
									common: {
										name: "Lowest temperature in °C",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "TN_C", {
										val: obj.TN_C,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "PROBPCP_PERCENT", {
									type: "state",
									common: {
										name: "Probability of precipitation in %",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "PROBPCP_PERCENT", {
										val: obj.PROBPCP_PERCENT,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "RRR_MM", {
									type: "state",
									common: {
										name: "Precipitation total",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "RRR_MM", {
										val: obj.RRR_MM,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "FF_KMH", {
									type: "state",
									common: {
										name: "Wind speed in km/h",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "FF_KMH", {
										val: obj.FF_KMH,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "FX_KMH", {
									type: "state",
									common: {
										name: "Peak wind speed in km/h",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "FX_KMH", {
										val: obj.FX_KMH,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "DD_DEG", {
									type: "state",
									common: {
										name: "Wind direction in angular degrees: 0 = North wind",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "DD_DEG", {
										val: obj.DD_DEG,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "SUNSET", {
									type: "state",
									common: {
										name: "Time sunset",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "SUNSET", {
										val: obj.SUNSET,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "SUNRISE", {
									type: "state",
									common: {
										name: "Time sunrise",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "SUNRISE", {
										val: obj.SUNRISE,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "SUN_H", {
									type: "state",
									common: {
										name: "Sun hours",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "SUN_H", {
										val: obj.SUN_H,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "SYMBOL_CODE", {
									type: "state",
									common: {
										name: "Mapping to weather icon",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "SYMBOL_CODE", {
										val: obj.SYMBOL_CODE,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "ICON_URL_COLOR", {
									type: "state",
									common: {
										name: "URL to color Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "ICON_URL_COLOR", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Color/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "ICON_URL_DARK", {
									type: "state",
									common: {
										name: "URL to dark Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "ICON_URL_DARK", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Dark/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "ICON_URL_LIGHT", {
									type: "state",
									common: {
										name: "URL to light Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "ICON_URL_LIGHT", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Light/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});

								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "type", {
									type: "state",
									common: {
										name: "result set; possible values: 60minutes, hour, day",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "type", {
										val: obj.type,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "min_color", {
									type: "channel",
									common: {
										name: "Mapping temperature / color value",
										role: "info"
									},
									native: {},
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "min_color." + "temperature", {
									type: "state",
									common: {
										name: "temperature",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "min_color." + "temperature", {
										val: obj.min_color.temperature,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "min_color." + "background_color", {
									type: "state",
									common: {
										name: "background color",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "min_color." + "background_color", {
										val: obj.min_color.background_color,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "min_color." + "text_color", {
									type: "state",
									common: {
										name: "text color",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "min_color." + "text_color", {
										val: obj.min_color.text_color,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "max_color", {
									type: "channel",
									common: {
										name: "Mapping temperature / color value",
										role: "info"
									},
									native: {},
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "max_color." + "temperature", {
									type: "state",
									common: {
										name: "temperature",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "max_color." + "temperature", {
										val: obj.max_color.temperature,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "max_color." + "background_color", {
									type: "state",
									common: {
										name: "background color",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "max_color." + "background_color", {
										val: obj.max_color.background_color,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "day." + myPath +"." + myTime +"." + "max_color." + "text_color", {
									type: "state",
									common: {
										name: "text color",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "day." + myPath +"." + myTime +"." + "max_color." + "text_color", {
										val: obj.max_color.text_color,
										ack: true
									});
								});
							});

							// *** Create hour forecast ***
							self.setObjectNotExists("forecast." + "hour", {
								type: "channel",
								common: {
									name: "forecast data for a time window of 3 hours (for 8 days from today 2:00 )",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "hour.day0", {
								type: "channel",
								common: {
									name: "Forecast data for today",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "hour.day1", {
								type: "channel",
								common: {
									name: "Forecast data for tomorrow",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "hour.day2", {
								type: "channel",
								common: {
									name: "Forecast data for today + 2 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "hour.day3", {
								type: "channel",
								common: {
									name: "Forecast data for today + 3 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "hour.day4", {
								type: "channel",
								common: {
									name: "Forecast data for today + 4 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "hour.day5", {
								type: "channel",
								common: {
									name: "Forecast data for today + 5 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "hour.day6", {
								type: "channel",
								common: {
									name: "Forecast data for today + 6 days",
									role: "info"
								},
								native: {},
							});
							self.setObjectNotExists("forecast." + "hour.day7", {
								type: "channel",
								common: {
									name: "Forecast data for today + 7 days",
									role: "info"
								},
								native: {},
							});


							//iterate over all hour objects
							body.forecast["hour"].forEach(function(obj,index) {
								var startTimeISOString = obj.local_date_time;
								var objDate = new Date(startTimeISOString);
								var myPath;
								var myTime =  getTimeFormattet(objDate);

								if (datesAreOnSameDay(today, objDate)) {
									myPath = "day0";
								} else if (datesAreOnSameDay(today1, objDate)) {
									myPath = "day1";
								} else if (datesAreOnSameDay(today2, objDate)) {
									myPath = "day2";
								} else if (datesAreOnSameDay(today3, objDate)) {
									myPath = "day3";
								} else if (datesAreOnSameDay(today4, objDate)) {
									myPath = "day4";
								} else if (datesAreOnSameDay(today5, objDate)) {
									myPath = "day5";
								} else if (datesAreOnSameDay(today6, objDate)) {
									myPath = "day6";
								} else if (datesAreOnSameDay(today7, objDate)) {
									myPath = "day7";
								} else {
									self.log.error("invalid date found. Could not assign date. The date received is not one of the coming week. " + startTimeISOString);
									return;
								}

								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "local_date_time", {
									type: "state",
									common: {
										name: "Date for validity of record",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "local_date_time", {
										val: obj.local_date_time,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "TTT_C", {
									type: "state",
									common: {
										name: "Current temperature in °C",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "TTT_C", {
										val: obj.TTT_C,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "TTL_C", {
									type: "state",
									common: {
										name: "Error range lower limit",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "TTL_C", {
										val: obj.TTL_C,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "TTH_C", {
									type: "state",
									common: {
										name: "Error range upper limit",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "TTH_C", {
										val: obj.TTH_C,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "PROBPCP_PERCENT", {
									type: "state",
									common: {
										name: "Probability of precipitation in %",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "PROBPCP_PERCENT", {
										val: obj.PROBPCP_PERCENT,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "RRR_MM", {
									type: "state",
									common: {
										name: "Precipitation total",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "RRR_MM", {
										val: obj.RRR_MM,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "FF_KMH", {
									type: "state",
									common: {
										name: "Wind speed in km/h",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "FF_KMH", {
										val: obj.FF_KMH,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "FX_KMH", {
									type: "state",
									common: {
										name: "Peak wind speed in km/h",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "FX_KMH", {
										val: obj.FX_KMH,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "DD_DEG", {
									type: "state",
									common: {
										name: "Wind direction in angular degrees: 0 = North wind",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "DD_DEG", {
										val: obj.DD_DEG,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "SYMBOL_CODE", {
									type: "state",
									common: {
										name: "Mapping to weather icon",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "SYMBOL_CODE", {
										val: obj.SYMBOL_CODE,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "ICON_URL_COLOR", {
									type: "state",
									common: {
										name: "URL to color Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "ICON_URL_COLOR", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Color/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "ICON_URL_DARK", {
									type: "state",
									common: {
										name: "URL to dark Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "ICON_URL_DARK", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Dark/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "ICON_URL_LIGHT", {
									type: "state",
									common: {
										name: "URL to light Icon",
										type: "string",
										role: "weather.icon"
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "ICON_URL_LIGHT", {
										val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Light/" + obj.SYMBOL_CODE + ".png",
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "type", {
									type: "state",
									common: {
										name: "result set; possible values: 60minutes, hour, day",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "type", {
										val: obj.type,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "cur_color", {
									type: "channel",
									common: {
										name: "Mapping temperature / color value",
										role: "info"
									},
									native: {},
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "cur_color." + "temperature", {
									type: "state",
									common: {
										name: "Temperature value",
										type: "number",
										role: "value",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "cur_color." + "temperature", {
										val: obj.cur_color.temperature,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "cur_color." + "background_color", {
									type: "state",
									common: {
										name: "background hex color value",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "cur_color." + "background_color", {
										val: obj.cur_color.background_color,
										ack: true
									});
								});
								self.setObjectNotExists("forecast." + "hour." + myPath +"." + myTime +"." + "cur_color." + "text_color", {
									type: "state",
									common: {
										name: "text hex color value",
										type: "string",
										role: "text",
										write: false
									},
									native: {},
								}, function () {
									self.setState("forecast." + "hour." + myPath +"." + myTime +"." + "cur_color." + "text_color", {
										val: obj.cur_color.text_color,
										ack: true
									});
								});
							});
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
		});
		res.on("error", function (error) {
			self.log.error(error)
		});
	});
	req.end();
	setTimeout(doIt, pollInterval, self);
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