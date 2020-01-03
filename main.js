"use strict";

/*
 * Created with @iobroker/create-adapter v1.18.0
 */
const utils = require("@iobroker/adapter-core");
const http = require("https");
const fs = require('fs');
const libxmljs = require('libxmljs2');
var xml;
var xmlDoc;

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

		//Prepare XML File in order to get the weather-icon
		self.log.debug("Define XML File:...");
		xml = fs.readFileSync(__dirname + "/img/weather-icons/SRG-SSR-WeatherAPITranslations.xml");
		xmlDoc = libxmljs.parseXmlString(xml);

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
		 * First get Access_Token, afterwards get forcast-informations for
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

				//********************************************************************************************
				//* Read Current Forcast
				//********************************************************************************************

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

						//**********************
						//*** Formatted Date
						//**********************
						//Set Current Forecast Values
						self.setObjectNotExists("CurrentForecast." + "formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast." + "formatted_date", { val: body.formatted_date.toString(), ack: true });

						//**********************
						//*** Current Day
						//**********************
						self.setObjectNotExists("CurrentForecast.current_day.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.current_day.date", { val: body.current_day.date.toString(), ack: true });

						self.setObjectNotExists("CurrentForecast.current_day.values.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.current_day.values.ttn", { val: body.current_day.values[0].ttn + " " + body.units.ttn.unit, ack: true });

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
						self.setStateAsync("CurrentForecast.current_day.values.ttx", { val: body.current_day.values[2].ttx + " " + body.units.ttx.unit, ack: true });

						//read icon-name for current_day
						self.log.debug("get icon-url by xpath for current day");
						var gchild = xmlDoc.get("/root/row[Code=" + body.current_day.values[1].smbd +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("CurrentForecast.current_day.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.current_day.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						//**********************
						//*** Current Hour
						//**********************
						if (Object.keys(body.current_hour).length > 0){
							self.setObjectNotExists("CurrentForecast.current_hour.date" , {
								type: "date",
								common: {
									name: "date",
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.date", { val: body.current_hour[0].date, ack: true });

							self.setObjectNotExists("CurrentForecast.current_hour.values.smb3" , {
								type: "state",
								common: {
									name: body.units.smb3.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.values.smb3", { val: body.current_hour[0].values[0].smb3, ack: true });

							//read icon-name for current_hour
							self.log.debug("get icon-url by xpath for current hour");
							var gchild = xmlDoc.get("/root/row[Code=" + body.current_hour[0].values[0].smb3 +"]/Code_icon");
							var icon = gchild.text();
							self.log.debug("Weather-Icon Name: " + icon);

							self.setObjectNotExists("CurrentForecast.current_hour.values.icon" , {
								type: "text.url",
								common: {
									name: "icon-url",
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

							self.setObjectNotExists("CurrentForecast.current_hour.values.ttt" , {
								type: "state",
								common: {
									name: body.units.ttt.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.values.ttt", { val: body.current_hour[0].values[1].ttt  + " " + body.units.ttt.unit, ack: true });

							self.setObjectNotExists("CurrentForecast.current_hour.values.fff" , {
								type: "state",
								common: {
									name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.values.fff", { val: body.current_hour[0].values[2].fff + " " + body.units.ff3.unit, ack: true });

							self.setObjectNotExists("CurrentForecast.current_hour.values.ffx3" , {
								type: "state",
								common: {
									name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'ffx3' is found. So i guess it could be 'fx3'
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.values.ffx3", { val: body.current_hour[0].values[3].ffx3  + " " + body.units.fx3.unit, ack: true });

							self.setObjectNotExists("CurrentForecast.current_hour.values.ddd" , {
								type: "state",
								common: {
									name: body.units.ddd.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.values.ddd", { val: body.current_hour[0].values[4].ddd  + " " + body.units.ddd.unit, ack: true });

							self.setObjectNotExists("CurrentForecast.current_hour.values.rr3" , {
								type: "state",
								common: {
									name: body.units.rr3.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.values.rr3", { val: body.current_hour[0].values[5].rr3  + " " + body.units.rr3.unit, ack: true });

							self.setObjectNotExists("CurrentForecast.current_hour.values.pr3" , {
								type: "state",
								common: {
									name: body.units.pr3.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("CurrentForecast.current_hour.values.pr3", { val: body.current_hour[0].values[6].pr3  + " " + body.units.pr3.unit, ack: true });

						} else {
							self.log.error("CurrentForecast - Current_hour is empty;")
						}

						//**********************
						//*** Info
						//**********************
						self.setObjectNotExists("info.id" , {
							type: "state",
							common: {
								name: "id",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("info.id", { val: body.info.id, ack: true });

						self.setObjectNotExists("info.plz" , {
							type: "state",
							common: {
								name: "plz",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("info.plz", { val: body.info.plz, ack: true });

						self.setObjectNotExists("info.name.de" , {
							type: "location",
							common: {
								name: "name",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("info.name.de", { val: body.info.name.de, ack: true });

						self.setObjectNotExists("CurrentForecast.status" , {
							type: "state",
							common: {
								name: "status",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.status", { val: "Success", ack: true });

					});
					res.on("error", function (error) {
						self.log.error(error);
						self.setObjectNotExists("CurrentForecast.status" , {
							type: "state",
							common: {
								name: "status",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("CurrentForecast.status", { val: error, ack: true });
					});
				});
				reqCurrentForecast.end();

				//********************************************************************************************
				//* Read Week Forcast
				//********************************************************************************************

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
						var chunksConcat = Buffer.concat(chunks).toString();
						chunksConcat = chunksConcat.replace(/7days/g, "sevendays");
						self.log.info("chunksConcat: " + chunksConcat);
						var body = JSON.parse(chunksConcat);
						self.log.info("Week Forecast: " + JSON.stringify(body));

						//**********************
						//*** Day 0
						//**********************
						self.setObjectNotExists("WeekForecast.day0.formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day0.formatted_date", { val: body.sevendays[0].formatted_date, ack: true });
						self.setObjectNotExists("WeekForecast.day0.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day0.ttn", { val: body.sevendays[0].values[0].ttn + " " + body.units.ttn.unit, ack: true });
						self.setObjectNotExists("WeekForecast.day0.smbd" , {
							type: "state",
							common: {
								name: body.units.smbd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day0.smbd", { val: body.sevendays[0].values[1].smbd, ack: true });
						//read icon-name
						self.log.debug("get icon-url by xpath for weekforecast.day0");
						var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[0].values[1].smbd +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("WeekForecast.day0.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day0.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });
						self.setObjectNotExists("WeekForecast.day0.ttx" , {
							type: "state",
							common: {
								name: body.units.ttx.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day0.ttx", { val: body.sevendays[0].values[2].ttx + " " + body.units.ttx.unit, ack: true });

						//**********************
						//*** Day 1
						//**********************
						self.setObjectNotExists("WeekForecast.day1.formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day1.formatted_date", { val: body.sevendays[1].formatted_date, ack: true });
						self.setObjectNotExists("WeekForecast.day1.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day1.ttn", { val: body.sevendays[1].values[0].ttn + " " + body.units.ttn.unit, ack: true });
						self.setObjectNotExists("WeekForecast.day1.smbd" , {
							type: "state",
							common: {
								name: body.units.smbd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day1.smbd", { val: body.sevendays[1].values[1].smbd, ack: true });
						//read icon-name
						self.log.debug("get icon-url by xpath for weekforecast.day1");
						var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[1].values[1].smbd +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("WeekForecast.day1.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day1.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });
						self.setObjectNotExists("WeekForecast.day1.ttx" , {
							type: "state",
							common: {
								name: body.units.ttx.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day1.ttx", { val: body.sevendays[1].values[2].ttx + " " + body.units.ttx.unit, ack: true });

						//**********************
						//*** Day 2
						//**********************
						self.setObjectNotExists("WeekForecast.day2.formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day2.formatted_date", { val: body.sevendays[2].formatted_date, ack: true });
						self.setObjectNotExists("WeekForecast.day2.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day2.ttn", { val: body.sevendays[2].values[0].ttn + " " + body.units.ttn.unit, ack: true });
						self.setObjectNotExists("WeekForecast.day2.smbd" , {
							type: "state",
							common: {
								name: body.units.smbd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day2.smbd", { val: body.sevendays[2].values[1].smbd, ack: true });
						//read icon-name
						self.log.debug("get icon-url by xpath for weekforecast.day2");
						var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[2].values[1].smbd +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("WeekForecast.day2.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day2.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });
						self.setObjectNotExists("WeekForecast.day2.ttx" , {
							type: "state",
							common: {
								name: body.units.ttx.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day2.ttx", { val: body.sevendays[2].values[2].ttx + " " + body.units.ttx.unit, ack: true });

						//**********************
						//*** Day 3
						//**********************
						self.setObjectNotExists("WeekForecast.day3.formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day3.formatted_date", { val: body.sevendays[3].formatted_date, ack: true });
						self.setObjectNotExists("WeekForecast.day3.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day3.ttn", { val: body.sevendays[3].values[0].ttn + " " + body.units.ttn.unit, ack: true });
						self.setObjectNotExists("WeekForecast.day3.smbd" , {
							type: "state",
							common: {
								name: body.units.smbd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day3.smbd", { val: body.sevendays[3].values[1].smbd, ack: true });
						//read icon-name
						self.log.debug("get icon-url by xpath for weekforecast.day3");
						var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[3].values[1].smbd +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("WeekForecast.day3.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day3.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });
						self.setObjectNotExists("WeekForecast.day3.ttx" , {
							type: "state",
							common: {
								name: body.units.ttx.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day3.ttx", { val: body.sevendays[3].values[2].ttx + " " + body.units.ttx.unit, ack: true });

						//**********************
						//*** Day 4
						//**********************
						self.setObjectNotExists("WeekForecast.day4.formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day4.formatted_date", { val: body.sevendays[4].formatted_date, ack: true });
						self.setObjectNotExists("WeekForecast.day4.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day4.ttn", { val: body.sevendays[4].values[0].ttn + " " + body.units.ttn.unit, ack: true });
						self.setObjectNotExists("WeekForecast.day4.smbd" , {
							type: "state",
							common: {
								name: body.units.smbd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day4.smbd", { val: body.sevendays[4].values[1].smbd, ack: true });
						//read icon-name
						self.log.debug("get icon-url by xpath for weekforecast.day4");
						var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[4].values[1].smbd +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("WeekForecast.day4.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day4.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });
						self.setObjectNotExists("WeekForecast.day4.ttx" , {
							type: "state",
							common: {
								name: body.units.ttx.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day4.ttx", { val: body.sevendays[4].values[2].ttx + " " + body.units.ttx.unit, ack: true });

						//**********************
						//*** Day 5
						//**********************
						self.setObjectNotExists("WeekForecast.day5.formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day5.formatted_date", { val: body.sevendays[5].formatted_date, ack: true });
						self.setObjectNotExists("WeekForecast.day5.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day5.ttn", { val: body.sevendays[5].values[0].ttn + " " + body.units.ttn.unit, ack: true });
						self.setObjectNotExists("WeekForecast.day5.smbd" , {
							type: "state",
							common: {
								name: body.units.smbd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day5.smbd", { val: body.sevendays[5].values[1].smbd, ack: true });
						//read icon-name
						self.log.debug("get icon-url by xpath for weekforecast.day5");
						var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[5].values[1].smbd +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("WeekForecast.day5.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day5.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });
						self.setObjectNotExists("WeekForecast.day5.ttx" , {
							type: "state",
							common: {
								name: body.units.ttx.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day5.ttx", { val: body.sevendays[5].values[2].ttx + " " + body.units.ttx.unit, ack: true });

						//**********************
						//*** Day 6
						//**********************
						self.setObjectNotExists("WeekForecast.day6.formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day6.formatted_date", { val: body.sevendays[6].formatted_date, ack: true });
						self.setObjectNotExists("WeekForecast.day6.ttn" , {
							type: "state",
							common: {
								name: body.units.ttn.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day6.ttn", { val: body.sevendays[6].values[0].ttn + " " + body.units.ttn.unit, ack: true });
						self.setObjectNotExists("WeekForecast.day6.smbd" , {
							type: "state",
							common: {
								name: body.units.smbd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day6.smbd", { val: body.sevendays[6].values[1].smbd, ack: true });
						//read icon-name
						self.log.debug("get icon-url by xpath for weekforecast.day6");
						var gchild = xmlDoc.get("/root/row[Code=" + body.sevendays[6].values[1].smbd +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("WeekForecast.day6.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day6.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });
						self.setObjectNotExists("WeekForecast.day6.ttx" , {
							type: "state",
							common: {
								name: body.units.ttx.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.day6.ttx", { val: body.sevendays[6].values[2].ttx + " " + body.units.ttx.unit, ack: true });

						self.setObjectNotExists("WeekForecast.status" , {
							type: "state",
							common: {
								name: "status",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.status", { val: "Success", ack: true });

					});
					res.on("error", function (error) {
						self.log.error(error);
						self.setObjectNotExists("WeekForecast.status" , {
							type: "state",
							common: {
								name: "status",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("WeekForecast.status", { val: error, ack: true });
					});
				});
				reqWeekForecast.end();

				//********************************************************************************************
				//* Read Hour Forcast
				//********************************************************************************************

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
						var body = JSON.parse(Buffer.concat(chunks).toString());
						self.log.info("Hour Forecast: " + JSON.stringify(body));

						//**********************
						//*** Formatted Date
						//**********************
						//Set Current Forecast Values
						self.setObjectNotExists("HourForecast." + "formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("HourForecast." + "formatted_date", { val: body.formatted_date.toString(), ack: true });

						//**********************
						//*** Next Hour
						//**********************
						if (Object.keys(body.nexthour).length > 0){
							self.setObjectNotExists("HourForecast.nexthour.date" , {
								type: "date",
								common: {
									name: "date",
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.date", { val: body.nexthour[0].date.toString(), ack: true });

							self.setObjectNotExists("HourForecast.nexthour.values.smb3" , {
								type: "state",
								common: {
									name: body.units.smb3.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.values.smb3", { val: body.nexthour[0].values[0].smb3, ack: true });

							//read icon-name
							self.log.debug("get icon-url by xpath for hourforecast.nexthour");
							var gchild = xmlDoc.get("/root/row[Code=" + body.nexthour[0].values[0].smb3 +"]/Code_icon");
							var icon = gchild.text();
							self.log.debug("Weather-Icon Name: " + icon);

							self.setObjectNotExists("HourForecast.nexthour.values.icon" , {
								type: "text.url",
								common: {
									name: "icon-url",
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

							self.setObjectNotExists("HourForecast.nexthour.values.ttt" , {
								type: "state",
								common: {
									name: body.units.ttt.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.values.ttt", { val: body.nexthour[0].values[1].ttt + " " + body.units.ttt.unit, ack: true });

							self.setObjectNotExists("HourForecast.nexthour.values.fff" , {
								type: "state",
								common: {
									name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.values.fff", { val: body.nexthour[0].values[2].fff + " " + body.units.ff3.unit, ack: true });

							self.setObjectNotExists("HourForecast.nexthour.values.ffx3" , {
								type: "state",
								common: {
									name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'ffx3' is found. So i guess it could be 'fx3'
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.values.ffx3", { val: body.nexthour[0].values[3].ffx3 + " " + body.units.fx3.unit, ack: true });

							self.setObjectNotExists("HourForecast.nexthour.values.ddd" , {
								type: "state",
								common: {
									name: body.units.ddd.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.values.ddd", { val: body.nexthour[0].values[4].ddd + " " + body.units.ddd.unit, ack: true });

							self.setObjectNotExists("HourForecast.nexthour.values.rr3" , {
								type: "state",
								common: {
									name: body.units.rr3.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.values.rr3", { val: body.nexthour[0].values[5].rr3 + " " + body.units.rr3.unit, ack: true });

							self.setObjectNotExists("HourForecast.nexthour.values.pr3" , {
								type: "state",
								common: {
									name: body.units.pr3.name,
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.nexthour.values.pr3", { val: body.nexthour[0].values[6].pr3 + " " + body.units.pr3.unit, ack: true });

							self.setObjectNotExists("HourForecast.status" , {
								type: "state",
								common: {
									name: "status",
									type: "string",
									role: "text"
								},
								native: {},
							});
							self.setStateAsync("HourForecast.status", { val: "Success", ack: true });

						} else {
							self.log.error("Hour Forecast - nexthour is empty;")
						}
					});
					res.on("error", function (error) {
						self.log.error(error);

						self.setObjectNotExists("HourForecast.status" , {
							type: "state",
							common: {
								name: "status",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("HourForecast.status", { val: error, ack: true });
					});
				});
				reqHourForecast.end();

				//********************************************************************************************
				//* Read 24h Forcast
				//********************************************************************************************

				//Options for getting 24h forecast using Authorization Bearer
				var options_24h_forecast = {
					"method": "GET",
					"hostname": "api.srgssr.ch",
					"port": null,
					"path": "/forecasts/v1.0/weather/24hour?latitude=" + latitude + "&longitude=" + longitude,
					"headers": {
						"authorization": "Bearer " + access_token
					}
				};
				var req24hForecast = http.request(options_24h_forecast, function (res) {
					var chunks = [];
					res.on("data", function (chunk) {
						chunks.push(chunk);
					});
					res.on("end", function () {
						var chunksConcat = Buffer.concat(chunks).toString();
						chunksConcat = chunksConcat.replace(/24hours/g, "twentyfourhours");
						self.log.info("chunksConcat: " + chunksConcat);
						var body = JSON.parse(chunksConcat);
						self.log.info("24h Forecast: " + JSON.stringify(body));

						//**********************
						//*** Formatted Date
						//**********************
						self.setObjectNotExists("24hForecast.formatted_date" , {
							type: "date",
							common: {
								name: "formatted_date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.formatted_date", { val: body.formatted_date.toString(), ack: true });

						//************************
						//*** 24h Hours - hour 0
						//************************
						self.setObjectNotExists("24hForecast.hour0.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.date", { val: body.twentyfourhours[0].date.toString(), ack: true });

						self.setObjectNotExists("24hForecast.hour0.values.smb3" , {
							type: "state",
							common: {
								name: body.units.smb3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.values.smb3", { val: body.twentyfourhours[0].values[0].smb3, ack: true });

						//read icon-name
						self.log.debug("get icon-url by xpath for 24h forecast.hour0");
						var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[0].values[0].smb3 +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("24hForecast.hour0.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						self.setObjectNotExists("24hForecast.hour0.values.ttt" , {
							type: "state",
							common: {
								name: body.units.ttt.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.values.ttt", { val: body.twentyfourhours[0].values[1].ttt, ack: true });

						self.setObjectNotExists("24hForecast.hour0.values.fff" , {
							type: "state",
							common: {
								name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.values.fff", { val: body.twentyfourhours[0].values[2].fff, ack: true });

						self.setObjectNotExists("24hForecast.hour0.values.ffx3" , {
							type: "state",
							common: {
								name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'fx3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.values.ffx3", { val: body.twentyfourhours[0].values[3].ffx3, ack: true });

						self.setObjectNotExists("24hForecast.hour0.values.ddd" , {
							type: "state",
							common: {
								name: body.units.ddd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.values.ddd", { val: body.twentyfourhours[0].values[4].ddd, ack: true });

						self.setObjectNotExists("24hForecast.hour0.values.rr3" , {
							type: "state",
							common: {
								name: body.units.rr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.values.rr3", { val: body.twentyfourhours[0].values[5].rr3, ack: true });

						self.setObjectNotExists("24hForecast.hour0.values.pr3" , {
							type: "state",
							common: {
								name: body.units.pr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour0.values.pr3", { val: body.twentyfourhours[0].values[6].pr3, ack: true });

						//************************
						//*** 24h Hours - hour 1
						//************************
						self.setObjectNotExists("24hForecast.hour1.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.date", { val: body.twentyfourhours[1].date.toString(), ack: true });

						self.setObjectNotExists("24hForecast.hour1.values.smb3" , {
							type: "state",
							common: {
								name: body.units.smb3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.values.smb3", { val: body.twentyfourhours[1].values[0].smb3, ack: true });

						//read icon-name
						self.log.debug("get icon-url by xpath for 24h forecast.hour1");
						var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[1].values[0].smb3 +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("24hForecast.hour1.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						self.setObjectNotExists("24hForecast.hour1.values.ttt" , {
							type: "state",
							common: {
								name: body.units.ttt.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.values.ttt", { val: body.twentyfourhours[1].values[1].ttt, ack: true });

						self.setObjectNotExists("24hForecast.hour1.values.fff" , {
							type: "state",
							common: {
								name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.values.fff", { val: body.twentyfourhours[1].values[2].fff, ack: true });

						self.setObjectNotExists("24hForecast.hour1.values.ffx3" , {
							type: "state",
							common: {
								name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'fx3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.values.ffx3", { val: body.twentyfourhours[1].values[3].ffx3, ack: true });

						self.setObjectNotExists("24hForecast.hour1.values.ddd" , {
							type: "state",
							common: {
								name: body.units.ddd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.values.ddd", { val: body.twentyfourhours[1].values[4].ddd, ack: true });

						self.setObjectNotExists("24hForecast.hour1.values.rr3" , {
							type: "state",
							common: {
								name: body.units.rr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.values.rr3", { val: body.twentyfourhours[1].values[5].rr3, ack: true });

						self.setObjectNotExists("24hForecast.hour1.values.pr3" , {
							type: "state",
							common: {
								name: body.units.pr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour1.values.pr3", { val: body.twentyfourhours[1].values[6].pr3, ack: true });

						//************************
						//*** 24h Hours - hour 2
						//************************
						self.setObjectNotExists("24hForecast.hour2.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.date", { val: body.twentyfourhours[2].date.toString(), ack: true });

						self.setObjectNotExists("24hForecast.hour2.values.smb3" , {
							type: "state",
							common: {
								name: body.units.smb3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.values.smb3", { val: body.twentyfourhours[2].values[0].smb3, ack: true });

						//read icon-name
						self.log.debug("get icon-url by xpath for 24h forecast.hour2");
						var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[2].values[0].smb3 +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("24hForecast.hour2.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						self.setObjectNotExists("24hForecast.hour2.values.ttt" , {
							type: "state",
							common: {
								name: body.units.ttt.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.values.ttt", { val: body.twentyfourhours[2].values[1].ttt, ack: true });

						self.setObjectNotExists("24hForecast.hour2.values.fff" , {
							type: "state",
							common: {
								name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.values.fff", { val: body.twentyfourhours[2].values[2].fff, ack: true });

						self.setObjectNotExists("24hForecast.hour2.values.ffx3" , {
							type: "state",
							common: {
								name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'fx3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.values.ffx3", { val: body.twentyfourhours[2].values[3].ffx3, ack: true });

						self.setObjectNotExists("24hForecast.hour2.values.ddd" , {
							type: "state",
							common: {
								name: body.units.ddd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.values.ddd", { val: body.twentyfourhours[2].values[4].ddd, ack: true });

						self.setObjectNotExists("24hForecast.hour2.values.rr3" , {
							type: "state",
							common: {
								name: body.units.rr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.values.rr3", { val: body.twentyfourhours[2].values[5].rr3, ack: true });

						self.setObjectNotExists("24hForecast.hour2.values.pr3" , {
							type: "state",
							common: {
								name: body.units.pr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour2.values.pr3", { val: body.twentyfourhours[2].values[6].pr3, ack: true });

						//************************
						//*** 24h Hours - hour 3
						//************************
						self.setObjectNotExists("24hForecast.hour3.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.date", { val: body.twentyfourhours[3].date.toString(), ack: true });

						self.setObjectNotExists("24hForecast.hour3.values.smb3" , {
							type: "state",
							common: {
								name: body.units.smb3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.values.smb3", { val: body.twentyfourhours[3].values[0].smb3, ack: true });

						//read icon-name
						self.log.debug("get icon-url by xpath for 24h forecast.hour3");
						var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[3].values[0].smb3 +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("24hForecast.hour3.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						self.setObjectNotExists("24hForecast.hour3.values.ttt" , {
							type: "state",
							common: {
								name: body.units.ttt.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.values.ttt", { val: body.twentyfourhours[3].values[1].ttt, ack: true });

						self.setObjectNotExists("24hForecast.hour3.values.fff" , {
							type: "state",
							common: {
								name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.values.fff", { val: body.twentyfourhours[3].values[2].fff, ack: true });

						self.setObjectNotExists("24hForecast.hour3.values.ffx3" , {
							type: "state",
							common: {
								name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'fx3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.values.ffx3", { val: body.twentyfourhours[3].values[3].ffx3, ack: true });

						self.setObjectNotExists("24hForecast.hour3.values.ddd" , {
							type: "state",
							common: {
								name: body.units.ddd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.values.ddd", { val: body.twentyfourhours[3].values[4].ddd, ack: true });

						self.setObjectNotExists("24hForecast.hour3.values.rr3" , {
							type: "state",
							common: {
								name: body.units.rr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.values.rr3", { val: body.twentyfourhours[3].values[5].rr3, ack: true });

						self.setObjectNotExists("24hForecast.hour3.values.pr3" , {
							type: "state",
							common: {
								name: body.units.pr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour3.values.pr3", { val: body.twentyfourhours[3].values[6].pr3, ack: true });

						//************************
						//*** 24h Hours - hour 4
						//************************
						self.setObjectNotExists("24hForecast.hour4.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.date", { val: body.twentyfourhours[4].date.toString(), ack: true });

						self.setObjectNotExists("24hForecast.hour4.values.smb3" , {
							type: "state",
							common: {
								name: body.units.smb3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.values.smb3", { val: body.twentyfourhours[4].values[0].smb3, ack: true });

						//read icon-name
						self.log.debug("get icon-url by xpath for 24h forecast.hour4");
						var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[4].values[0].smb3 +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("24hForecast.hour4.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						self.setObjectNotExists("24hForecast.hour4.values.ttt" , {
							type: "state",
							common: {
								name: body.units.ttt.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.values.ttt", { val: body.twentyfourhours[4].values[1].ttt, ack: true });

						self.setObjectNotExists("24hForecast.hour4.values.fff" , {
							type: "state",
							common: {
								name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.values.fff", { val: body.twentyfourhours[4].values[2].fff, ack: true });

						self.setObjectNotExists("24hForecast.hour4.values.ffx3" , {
							type: "state",
							common: {
								name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'fx3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.values.ffx3", { val: body.twentyfourhours[4].values[3].ffx3, ack: true });

						self.setObjectNotExists("24hForecast.hour4.values.ddd" , {
							type: "state",
							common: {
								name: body.units.ddd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.values.ddd", { val: body.twentyfourhours[4].values[4].ddd, ack: true });

						self.setObjectNotExists("24hForecast.hour4.values.rr3" , {
							type: "state",
							common: {
								name: body.units.rr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.values.rr3", { val: body.twentyfourhours[4].values[5].rr3, ack: true });

						self.setObjectNotExists("24hForecast.hour4.values.pr3" , {
							type: "state",
							common: {
								name: body.units.pr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour4.values.pr3", { val: body.twentyfourhours[4].values[6].pr3, ack: true });

						//************************
						//*** 24h Hours - hour 5
						//************************
						self.setObjectNotExists("24hForecast.hour5.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.date", { val: body.twentyfourhours[5].date.toString(), ack: true });

						self.setObjectNotExists("24hForecast.hour5.values.smb3" , {
							type: "state",
							common: {
								name: body.units.smb3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.values.smb3", { val: body.twentyfourhours[5].values[0].smb3, ack: true });

						//read icon-name
						self.log.debug("get icon-url by xpath for 24h forecast.hour5");
						var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[5].values[0].smb3 +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("24hForecast.hour5.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						self.setObjectNotExists("24hForecast.hour5.values.ttt" , {
							type: "state",
							common: {
								name: body.units.ttt.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.values.ttt", { val: body.twentyfourhours[5].values[1].ttt, ack: true });

						self.setObjectNotExists("24hForecast.hour5.values.fff" , {
							type: "state",
							common: {
								name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.values.fff", { val: body.twentyfourhours[5].values[2].fff, ack: true });

						self.setObjectNotExists("24hForecast.hour5.values.ffx3" , {
							type: "state",
							common: {
								name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'fx3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.values.ffx3", { val: body.twentyfourhours[5].values[3].ffx3, ack: true });

						self.setObjectNotExists("24hForecast.hour5.values.ddd" , {
							type: "state",
							common: {
								name: body.units.ddd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.values.ddd", { val: body.twentyfourhours[5].values[4].ddd, ack: true });

						self.setObjectNotExists("24hForecast.hour5.values.rr3" , {
							type: "state",
							common: {
								name: body.units.rr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.values.rr3", { val: body.twentyfourhours[5].values[5].rr3, ack: true });

						self.setObjectNotExists("24hForecast.hour5.values.pr3" , {
							type: "state",
							common: {
								name: body.units.pr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour5.values.pr3", { val: body.twentyfourhours[5].values[6].pr3, ack: true });

						//************************
						//*** 24h Hours - hour 6
						//************************
						self.setObjectNotExists("24hForecast.hour6.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.date", { val: body.twentyfourhours[6].date.toString(), ack: true });

						self.setObjectNotExists("24hForecast.hour6.values.smb3" , {
							type: "state",
							common: {
								name: body.units.smb3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.values.smb3", { val: body.twentyfourhours[6].values[0].smb3, ack: true });

						//read icon-name
						self.log.debug("get icon-url by xpath for 24h forecast.hour6");
						var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[6].values[0].smb3 +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("24hForecast.hour6.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						self.setObjectNotExists("24hForecast.hour6.values.ttt" , {
							type: "state",
							common: {
								name: body.units.ttt.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.values.ttt", { val: body.twentyfourhours[6].values[1].ttt, ack: true });

						self.setObjectNotExists("24hForecast.hour6.values.fff" , {
							type: "state",
							common: {
								name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.values.fff", { val: body.twentyfourhours[6].values[2].fff, ack: true });

						self.setObjectNotExists("24hForecast.hour6.values.ffx3" , {
							type: "state",
							common: {
								name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'fx3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.values.ffx3", { val: body.twentyfourhours[6].values[3].ffx3, ack: true });

						self.setObjectNotExists("24hForecast.hour6.values.ddd" , {
							type: "state",
							common: {
								name: body.units.ddd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.values.ddd", { val: body.twentyfourhours[6].values[4].ddd, ack: true });

						self.setObjectNotExists("24hForecast.hour6.values.rr3" , {
							type: "state",
							common: {
								name: body.units.rr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.values.rr3", { val: body.twentyfourhours[6].values[5].rr3, ack: true });

						self.setObjectNotExists("24hForecast.hour6.values.pr3" , {
							type: "state",
							common: {
								name: body.units.pr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour6.values.pr3", { val: body.twentyfourhours[6].values[6].pr3, ack: true });

						//************************
						//*** 24h Hours - hour 7
						//************************
						self.setObjectNotExists("24hForecast.hour7.date" , {
							type: "date",
							common: {
								name: "date",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.date", { val: body.twentyfourhours[7].date.toString(), ack: true });

						self.setObjectNotExists("24hForecast.hour7.values.smb3" , {
							type: "state",
							common: {
								name: body.units.smb3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.values.smb3", { val: body.twentyfourhours[7].values[0].smb3, ack: true });

						//read icon-name
						self.log.debug("get icon-url by xpath for 24h forecast.hour7");
						var gchild = xmlDoc.get("/root/row[Code=" + body.twentyfourhours[7].values[0].smb3 +"]/Code_icon");
						var icon = gchild.text();
						self.log.debug("Weather-Icon Name: " + icon);

						self.setObjectNotExists("24hForecast.hour7.values.icon" , {
							type: "text.url",
							common: {
								name: "icon-url",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.values.icon", { val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/weather-icons/png_64x64/"+ icon +".png", ack: true });

						self.setObjectNotExists("24hForecast.hour7.values.ttt" , {
							type: "state",
							common: {
								name: body.units.ttt.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.values.ttt", { val: body.twentyfourhours[7].values[1].ttt, ack: true });

						self.setObjectNotExists("24hForecast.hour7.values.fff" , {
							type: "state",
							common: {
								name: body.units.ff3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'ff3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.values.fff", { val: body.twentyfourhours[7].values[2].fff, ack: true });

						self.setObjectNotExists("24hForecast.hour7.values.ffx3" , {
							type: "state",
							common: {
								name: body.units.fx3.name, //todo send srf: this is maybe the wrong attribute. But no unit-Attribute for 'fff' is found. So i guess it could be 'fx3'
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.values.ffx3", { val: body.twentyfourhours[7].values[3].ffx3, ack: true });

						self.setObjectNotExists("24hForecast.hour7.values.ddd" , {
							type: "state",
							common: {
								name: body.units.ddd.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.values.ddd", { val: body.twentyfourhours[7].values[4].ddd, ack: true });

						self.setObjectNotExists("24hForecast.hour7.values.rr3" , {
							type: "state",
							common: {
								name: body.units.rr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.values.rr3", { val: body.twentyfourhours[7].values[5].rr3, ack: true });

						self.setObjectNotExists("24hForecast.hour7.values.pr3" , {
							type: "state",
							common: {
								name: body.units.pr3.name,
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.hour7.values.pr3", { val: body.twentyfourhours[7].values[6].pr3, ack: true });

						self.setObjectNotExists("24hForecast.status" , {
							type: "state",
							common: {
								name: "status",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.status", { val: "success", ack: true });


					});
					res.on("error", function (error) {
						self.log.error(error);
						self.setObjectNotExists("24hForecast.status" , {
							type: "state",
							common: {
								name: "status",
								type: "string",
								role: "text"
							},
							native: {},
						});
						self.setStateAsync("24hForecast.status", { val: error, ack: true });
					});
				});
				req24hForecast.end();
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