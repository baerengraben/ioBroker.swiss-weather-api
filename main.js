"use strict";
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

/*
 * Created with @iobroker/create-adapter v1.18.0
 */
const utils = require("@iobroker/adapter-core");
var dns = require('dns');
const cron = require('node-cron');
const { https } = require('follow-redirects');
const adapterName = "swiss-weather-api";
const undf = "undefined"
var defaultLanguage = "de";
var timeout;
var geolocationId;
var access_token;
let cronJob;
var today;
// @ts-ignore
var today1;
// @ts-ignore
var today2;
// @ts-ignore
var today3;
// @ts-ignore
var today4;
// @ts-ignore
var today5;
// @ts-ignore
var today6;
// @ts-ignore
var today7;
// @ts-ignore
var lastSuccessfulRun;

// @ts-ignore
Date.prototype.addDays = function(days) {
	var date = new Date(this.valueOf());
	date.setDate(date.getDate() + days);
	return date;
}

/**
 * Checks if JSON is valid
 * @param str JSON String
 * @returns {boolean} true == valid; false == invalid
 */
function isValidJSONString(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

/**
 * returns formattet Time
 * @param actualDate  Date Object
 * @returns {string}  hour + min + sec
 */
function getTimeFormattet(actualDate) {
	var	hour = (actualDate.getHours()<10?'0':'') + actualDate.getHours();
	var min = (actualDate.getMinutes()<10?'0':'') + actualDate.getMinutes();
//	var sec = (actualDate.getSeconds()<10?'0':'') + actualDate.getSeconds(); // removed due to https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/57
	return hour + min;
}

/**
 * returns formattet Date
 * @param actualDate Date Object
 * @returns {string} hour + ":" + minutes + " " + day + "." + month + "." + year
 */
function getActualDateFormattet(actualDate) {
	var	year = (actualDate.getFullYear());
	var month = ((actualDate.getMonth()+1)<10?'0':'') + (actualDate.getMonth()+1);
	var day = (actualDate.getDate()<10?'0':'') + actualDate.getDate();
	var hour = (actualDate.getHours()<10?'0':'') + actualDate.getHours();
	var minutes = (actualDate.getMinutes()<10?'0':'') + actualDate.getMinutes();
	return hour + ":" + minutes + " " + day + "." + month + "." + year;
}

/**
 * Get name of day
 * @param date Date Object
 * @param defaultLanguage language code
 * @returns {string} Name of Day
 */
function getDayName(date,defaultLanguage){
	var mainversion = parseInt(process.version.substr(1,2))
	var weekday;
	var arrayOfWeekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
	// dateObj.toLocaleString("default", { weekday: "long" }) is only supported > nodejs 13
	if (mainversion >12){
		weekday = date.toLocaleString(defaultLanguage , { weekday: "long" });
	} else {
		var weekdayNumber = date.getDay();
		weekday =  arrayOfWeekdays[weekdayNumber];
	}
	return weekday;
}

/**
 * Get longitude/latitude from system if not set or not valid
 * do not change if we have already a valid value
 * so we could use different settings compared to system if necessary
 * @param self Adapter
 */
function getSystemData(self) {
	if (typeof self.config.Longitude === undf || self.config.Longitude == null || self.config.Longitude.length === 0 || isNaN(self.config.Longitude)
		|| typeof self.config.Latitude === undf || self.config.Latitude == null || self.config.Latitude.length === 0 || isNaN(self.config.Latitude)) {
		self.log.info("longitude/longitude not set, get data from system ");
		self.getForeignObject("system.config", (err, state) => {
			if (err || state === undf || state === null) {
				self.log.error("longitude/latitude not set in adapter-config and reading in system-config failed");
				self.setState('info.connection', false, true);
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

/**
 * Reads ioBroker default Language and set it to adapter defaultLanguage
 * @param self Adapter,
 */
function getSystemLanguage(self) {
	self.getForeignObject("system.config", (err, state) => {
		if (err || state === undf || state === null) {
			self.log.error("Default language not set in system-config. Setting default language as 'de' to use for weekday names.");
			self.defaultLanguage = "de";
		} else {
			self.defaultLanguage = state.common.language;
			self.log.debug("use system  language for weekday names: " + self.defaultLanguage);
		}
	});
}

/**
 * Creates a json Object for usage with Material Design JSON Chart
 * @param body srf api response containing 60minutes json object
 * @returns {*[]} containing Json for usage with Material Design JSON Chart
 */
function createJson(body) {
	//Templates
	let myHoursFull = [
		"1h",
		"2h",
		"3h",
		"4h",
		"5h",
		"6h",
		"7h",
		"8h",
		"9h",
		"10h",
		"11h",
		"12h",
		"13h",
		"14h",
		"15h",
		"16h",
		"17h",
		"18h",
		"19h",
		"20h",
		"21h",
		"22h",
		"23h",
		"24h"
	];
	let myHoursReduced = [
		"1h",
		"2h",
		"3h"
	];
	let myGraphsTemplateTemperatur = {
		"data": [
			17,
			19,
			18,
			19,
			19,
			20,
			20,
			21,
			22,
			24,
			24,
			24,
			23,
			22,
			23,
			23,
			24,
			23,
			23,
			22,
			22,
			21,
			20,
			20
		],
		"type": "line",
		"color": "gray",
		"legendText": "Temperatur",
		"line_pointSizeHover": 5,
		"line_pointSize": 0,
		"line_Tension": 0.3,
		"yAxis_show": false,
		"yAxis_gridLines_show": false,
		"yAxis_gridLines_ticks_length": 5,
		"yAxis_min": 0,
		"yAxis_max": 30,
		"yAxis_step": 5,
		"yAxis_position": "left",
		"yAxis_appendix": " °C",
		"yAxis_zeroLineWidth": 0.1,
		"yAxis_zeroLineColor": "black",
		"displayOrder": 0,
		"tooltip_AppendText": " °C",
		"datalabel_backgroundColor": [
			"#2b9a44",
			"#2b9a44",
			"#3aa35b",
			"#2b9a44",
			"#2b9a44",
			"#1d922e",
			"#1d922e",
			"#0e8917",
			"#008000",
			"#668f00",
			"#668f00",
			"#668f00",
			"#338700",
			"#008000",
			"#338700",
			"#338700",
			"#668f00",
			"#338700",
			"#338700",
			"#008000",
			"#008000",
			"#0e8917",
			"#1d922e",
			"#1d922e"
		],
		"datalabel_color": "white",
		"datalabel_offset": -10,
		"datalabel_fontFamily": "RobotoCondensed-Light",
		"datalabel_fontSize": 12,
		"datalabel_borderRadius": 6,
		"datalabel_show": "auto",
		"line_PointColor": [
			"#2b9a44",
			"#2b9a44",
			"#3aa35b",
			"#2b9a44",
			"#2b9a44",
			"#1d922e",
			"#1d922e",
			"#0e8917",
			"#008000",
			"#668f00",
			"#668f00",
			"#668f00",
			"#338700",
			"#008000",
			"#338700",
			"#338700",
			"#668f00",
			"#338700",
			"#338700",
			"#008000",
			"#008000",
			"#0e8917",
			"#1d922e",
			"#1d922e"
		],
		"line_PointColorBorder": [
			"#2b9a44",
			"#2b9a44",
			"#3aa35b",
			"#2b9a44",
			"#2b9a44",
			"#1d922e",
			"#1d922e",
			"#0e8917",
			"#008000",
			"#668f00",
			"#668f00",
			"#668f00",
			"#338700",
			"#008000",
			"#338700",
			"#338700",
			"#668f00",
			"#338700",
			"#338700",
			"#008000",
			"#008000",
			"#0e8917",
			"#1d922e",
			"#1d922e"
		],
		"line_PointColorHover": [
			"#2b9a44",
			"#2b9a44",
			"#3aa35b",
			"#2b9a44",
			"#2b9a44",
			"#1d922e",
			"#1d922e",
			"#0e8917",
			"#008000",
			"#668f00",
			"#668f00",
			"#668f00",
			"#338700",
			"#008000",
			"#338700",
			"#338700",
			"#668f00",
			"#338700",
			"#338700",
			"#008000",
			"#008000",
			"#0e8917",
			"#1d922e",
			"#1d922e"
		],
		"line_PointColorBorderHover": [
			"#2b9a44",
			"#2b9a44",
			"#3aa35b",
			"#2b9a44",
			"#2b9a44",
			"#1d922e",
			"#1d922e",
			"#0e8917",
			"#008000",
			"#668f00",
			"#668f00",
			"#668f00",
			"#338700",
			"#008000",
			"#338700",
			"#338700",
			"#668f00",
			"#338700",
			"#338700",
			"#008000",
			"#008000",
			"#0e8917",
			"#1d922e",
			"#1d922e"
		],
		"use_gradient_color": true,
		"gradient_color": [
			{
				"value": -20,
				"color": "#5b2c6f66"
			},
			{
				"value": 0,
				"color": "#2874a666"
			},
			{
				"value": 14,
				"color": "#73c6b666"
			},
			{
				"value": 22,
				"color": "#00800066"
			},
			{
				"value": 27,
				"color": "#ffa50066"
			},
			{
				"value": 35,
				"color": "#ff000066"
			}
		],
		"use_line_gradient_fill_color": true,
		"line_gradient_fill_color": [
			{
				"value": -20,
				"color": "#5b2c6f66"
			},
			{
				"value": 0,
				"color": "#2874a666"
			},
			{
				"value": 14,
				"color": "#73c6b666"
			},
			{
				"value": 22,
				"color": "#00800066"
			},
			{
				"value": 27,
				"color": "#ffa50066"
			},
			{
				"value": 35,
				"color": "#ff000066"
			}
		]
	};
	let myGraphsTemplateRegenwahrscheinlichkeit = {
		"data": [
			50,
			50,
			50,
			50,
			50,
			50,
			50,
			50,
			50,
			50,
			50,
			50,
			50,
			19,
			33,
			36,
			23,
			14,
			16,
			34,
			46,
			40,
			24,
			22
		],
		"type": "line",
		"color": "#93BDFF",
		"legendText": "Regenwahrscheinlichkeit",
		"line_UseFillColor": true,
		"line_pointSize": 0,
		"line_pointSizeHover": 5,
		"yAxis_min": 0,
		"yAxis_max": 100,
		"yAxis_maxSteps": 10,
		"yAxis_position": "left",
		"yAxis_gridLines_show": false,
		"yAxis_gridLines_border_show": false,
		"yAxis_zeroLineWidth": 0.1,
		"yAxis_zeroLineColor": "black",
		"yAxis_appendix": " %",
		"displayOrder": 1,
		"tooltip_AppendText": " %",
		"datalabel_show": false
	};
	let myGraphsTemplateNiederschlag = {
		"data": [
			"0",
			"0",
			"0",
			"0",
			"0",
			"0",
			"0",
			"0",
			"0",
			"0",
			"0",
			"1.3",
			"2.5",
			0,
			1.9,
			1.17,
			0,
			0,
			0,
			0.18,
			0.7,
			0.2,
			0,
			0
		],
		"type": "bar",
		"color": "#0061C1",
		"legendText": "Niederschlag",
		"yAxis_min": 0,
		"yAxis_max": 5,
		"yAxis_maxSteps": 10,
		"yAxis_position": "right",
		"yAxis_gridLines_show": false,
		"yAxis_appendix": " mm",
		"yAxis_gridLines_border_show": false,
		"yAxis_zeroLineWidth": 0.1,
		"yAxis_zeroLineColor": "black",
		"displayOrder": 1,
		"tooltip_AppendText": " mm",
		"datalabel_show": false
	};
	var chartJson = [];

	//Day0
	var chartJsonDay0 = {} // empty Object
	var axisLabelsDay0 = 'axisLabels';
	var graphsDay0 = 'graphs';
	chartJsonDay0[axisLabelsDay0] = []; // empty Array, push axisLabels attributes in here
	chartJsonDay0[graphsDay0] = []; // empty Array, push graphs attributes in here
	let myGraphsTemperaturDay0 = JSON.parse(JSON.stringify(myGraphsTemplateTemperatur));
	let myGraphsTemperaturDataDay0 = [];
	let myGraphsNiederschlagDay0 = JSON.parse(JSON.stringify(myGraphsTemplateNiederschlag));
	let myGraphsNiederschlagDataDay0 = [];
	let myGraphsRegenwahrscheinlichkeitDay0 = JSON.parse(JSON.stringify(myGraphsTemplateRegenwahrscheinlichkeit));
	let myGraphsRegenwahrscheinlichkeitDataDay0 = [];

	//Day1
	var chartJsonDay1 = {} // empty Object
	var axisLabelsDay1 = 'axisLabels';
	var graphsDay1 = 'graphs';
	chartJsonDay1[axisLabelsDay1] = []; // empty Array, push axisLabels attributes in here
	chartJsonDay1[graphsDay1] = []; // empty Array, push graphs attributes in here
	let myGraphsTemperaturDay1 = JSON.parse(JSON.stringify(myGraphsTemplateTemperatur));
	let myGraphsTemperaturDataDay1 = [];
	let myGraphsNiederschlagDay1 = JSON.parse(JSON.stringify(myGraphsTemplateNiederschlag));
	let myGraphsNiederschlagDataDay1 = [];
	let myGraphsRegenwahrscheinlichkeitDay1 = JSON.parse(JSON.stringify(myGraphsTemplateRegenwahrscheinlichkeit));
	let myGraphsRegenwahrscheinlichkeitDataDay1 = [];

	//Day2
	var chartJsonDay2 = {} // empty Object
	var axisLabelsDay2 = 'axisLabels';
	var graphsDay2 = 'graphs';
	chartJsonDay2[axisLabelsDay2] = []; // empty Array, push axisLabels attributes in here
	chartJsonDay2[graphsDay2] = []; // empty Array, push graphs attributes in here
	let myGraphsTemperaturDay2 = JSON.parse(JSON.stringify(myGraphsTemplateTemperatur));
	let myGraphsTemperaturDataDay2 = [];
	let myGraphsNiederschlagDay2 = JSON.parse(JSON.stringify(myGraphsTemplateNiederschlag));
	let myGraphsNiederschlagDataDay2 = [];
	let myGraphsRegenwahrscheinlichkeitDay2 = JSON.parse(JSON.stringify(myGraphsTemplateRegenwahrscheinlichkeit));
	let myGraphsRegenwahrscheinlichkeitDataDay2 = [];

	//Day3
	var chartJsonDay3 = {} // empty Object
	var axisLabelsDay3 = 'axisLabels';
	var graphsDay3 = 'graphs';
	chartJsonDay3[axisLabelsDay3] = []; // empty Array, push axisLabels attributes in here
	chartJsonDay3[graphsDay3] = []; // empty Array, push graphs attributes in here
	let myGraphsTemperaturDay3 = JSON.parse(JSON.stringify(myGraphsTemplateTemperatur));
	let myGraphsTemperaturDataDay3 = [];
	let myGraphsNiederschlagDay3 = JSON.parse(JSON.stringify(myGraphsTemplateNiederschlag));
	let myGraphsNiederschlagDataDay3 = [];
	let myGraphsRegenwahrscheinlichkeitDay3 = JSON.parse(JSON.stringify(myGraphsTemplateRegenwahrscheinlichkeit));
	let myGraphsRegenwahrscheinlichkeitDataDay3 = [];

	//Day4
	var chartJsonDay4 = {} // empty Object
	var axisLabelsDay4 = 'axisLabels';
	var graphsDay4 = 'graphs';
	chartJsonDay4[axisLabelsDay4] = []; // empty Array, push axisLabels attributes in here
	chartJsonDay4[graphsDay4] = []; // empty Array, push graphs attributes in here
	let myGraphsTemperaturDay4 = JSON.parse(JSON.stringify(myGraphsTemplateTemperatur));
	let myGraphsTemperaturDataDay4 = [];
	let myGraphsNiederschlagDay4 = JSON.parse(JSON.stringify(myGraphsTemplateNiederschlag));
	let myGraphsNiederschlagDataDay4 = [];
	let myGraphsRegenwahrscheinlichkeitDay4 = JSON.parse(JSON.stringify(myGraphsTemplateRegenwahrscheinlichkeit));
	let myGraphsRegenwahrscheinlichkeitDataDay4 = [];

	body.forecast["60minutes"].forEach(function(obj,index) {
		if (index < 24) {
			if (typeof obj.TTT_C !== undf || obj.TTT_C != null) {
				myGraphsTemperaturDataDay0.push(obj.TTT_C);
			}
			if (typeof obj.PROBPCP_PERCENT !== undf || obj.PROBPCP_PERCENT != null) {
				myGraphsRegenwahrscheinlichkeitDataDay0.push(obj.PROBPCP_PERCENT);
			}
			if (typeof obj.RRR_MM !==undf || obj.RRR_MM != null) {
				myGraphsNiederschlagDataDay0.push(obj.RRR_MM);
			}
		} else if (index > 23 && index < 48){
			if (typeof obj.TTT_C !== undf || obj.TTT_C != null) {
				myGraphsTemperaturDataDay1.push(obj.TTT_C);
			}
			if (typeof obj.PROBPCP_PERCENT !== undf || obj.PROBPCP_PERCENT != null) {
				myGraphsRegenwahrscheinlichkeitDataDay1.push(obj.PROBPCP_PERCENT);
			}
			if (typeof obj.RRR_MM !== undf || obj.RRR_MM != null) {
				myGraphsNiederschlagDataDay1.push(obj.RRR_MM);
			}
		} else if  (index > 47 && index < 72){
			if (typeof obj.TTT_C !== undf || obj.TTT_C != null) {
				myGraphsTemperaturDataDay2.push(obj.TTT_C);
			}
			if (typeof obj.PROBPCP_PERCENT !== undf || obj.PROBPCP_PERCENT != null) {
				myGraphsRegenwahrscheinlichkeitDataDay2.push(obj.PROBPCP_PERCENT);
			}
			if (typeof obj.RRR_MM !== undf || obj.RRR_MM != null) {
				myGraphsNiederschlagDataDay2.push(obj.RRR_MM);
			}
		} else if  (index > 71 && index < 96){
			if (typeof obj.TTT_C !== undf || obj.TTT_C != null) {
				myGraphsTemperaturDataDay3.push(obj.TTT_C);
			}
			if (typeof obj.PROBPCP_PERCENT !== undf || obj.PROBPCP_PERCENT != null) {
				myGraphsRegenwahrscheinlichkeitDataDay3.push(obj.PROBPCP_PERCENT);
			}
			if (typeof obj.RRR_MM !== undf || obj.RRR_MM != null) {
				myGraphsNiederschlagDataDay3.push(obj.RRR_MM);
			}
		} else if  (index > 95){
			if (typeof obj.TTT_C !== undf || obj.TTT_C != null) {
				myGraphsTemperaturDataDay4.push(obj.TTT_C);
			}
			if (typeof obj.PROBPCP_PERCENT !== undf || obj.PROBPCP_PERCENT != null) {
				myGraphsRegenwahrscheinlichkeitDataDay4.push(obj.PROBPCP_PERCENT);
			}
			if (typeof obj.RRR_MM !== undf || obj.RRR_MM != null) {
				myGraphsNiederschlagDataDay4.push(obj.RRR_MM);
			}
		}
	});

	// Day0
	myGraphsTemperaturDay0.data = myGraphsTemperaturDataDay0;
	myGraphsRegenwahrscheinlichkeitDay0.data = myGraphsRegenwahrscheinlichkeitDataDay0;
	myGraphsNiederschlagDay0.data = myGraphsNiederschlagDataDay0;
	// Day1
	myGraphsTemperaturDay1.data = myGraphsTemperaturDataDay1;
	myGraphsRegenwahrscheinlichkeitDay1.data = myGraphsRegenwahrscheinlichkeitDataDay1;
	myGraphsNiederschlagDay1.data = myGraphsNiederschlagDataDay1;
	// Day2
	myGraphsTemperaturDay2.data = myGraphsTemperaturDataDay2;
	myGraphsRegenwahrscheinlichkeitDay2.data = myGraphsRegenwahrscheinlichkeitDataDay2;
	myGraphsNiederschlagDay2.data = myGraphsNiederschlagDataDay2;
	// Day3
	myGraphsTemperaturDay3.data = myGraphsTemperaturDataDay3;
	myGraphsRegenwahrscheinlichkeitDay3.data = myGraphsRegenwahrscheinlichkeitDataDay3;
	myGraphsNiederschlagDay3.data = myGraphsNiederschlagDataDay3;
	// Day4
	myGraphsTemperaturDay4.data = myGraphsTemperaturDataDay4;
	myGraphsRegenwahrscheinlichkeitDay4.data = myGraphsRegenwahrscheinlichkeitDataDay4;
	myGraphsNiederschlagDay4.data = myGraphsNiederschlagDataDay4;

	//Day0
	chartJsonDay0[axisLabelsDay0] = myHoursFull;
	chartJsonDay0[graphsDay0].push(myGraphsTemperaturDay0 );
	chartJsonDay0[graphsDay0].push(myGraphsRegenwahrscheinlichkeitDay0);
	chartJsonDay0[graphsDay0].push(myGraphsNiederschlagDay0);
	//Day1
	chartJsonDay1[axisLabelsDay1] = myHoursFull;
	chartJsonDay1[graphsDay1].push(myGraphsTemperaturDay1);
	chartJsonDay1[graphsDay1].push(myGraphsRegenwahrscheinlichkeitDay1);
	chartJsonDay1[graphsDay1].push(myGraphsNiederschlagDay1);
	//Day2
	chartJsonDay2[axisLabelsDay2] = myHoursFull;
	chartJsonDay2[graphsDay2].push(myGraphsTemperaturDay2);
	chartJsonDay2[graphsDay2].push(myGraphsRegenwahrscheinlichkeitDay2);
	chartJsonDay2[graphsDay2].push(myGraphsNiederschlagDay2);
	//Day3
	chartJsonDay3[axisLabelsDay3] = myHoursFull;
	chartJsonDay3[graphsDay3].push(myGraphsTemperaturDay3);
	chartJsonDay3[graphsDay3].push(myGraphsRegenwahrscheinlichkeitDay3);
	chartJsonDay3[graphsDay3].push(myGraphsNiederschlagDay3);
	//Day4
	chartJsonDay4[axisLabelsDay4] = myHoursReduced;
	chartJsonDay4[graphsDay4].push(myGraphsTemperaturDay4);
	chartJsonDay4[graphsDay4].push(myGraphsRegenwahrscheinlichkeitDay4);
	chartJsonDay4[graphsDay4].push(myGraphsNiederschlagDay4);

	chartJson.push(chartJsonDay0);
	chartJson.push(chartJsonDay1);
	chartJson.push(chartJsonDay2);
	chartJson.push(chartJsonDay3);
	chartJson.push(chartJsonDay4);

	return chartJson;
}

/**
 * Get Token by REST-Calling SRF Weather API
 * @param self this adapter
 * @param myCallback Callback
 */
function getToken(self,myCallback){
	self.log.debug('getting Token...');

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

	self.log.debug("Options to get Access Token: " + JSON.stringify(options_Access_Token));

	var req = https.request(options_Access_Token, function (res) {
		var chunks = [];
		res.on("data", function (chunk) {
			chunks.push(chunk);
		});
		res.on("end", function () {
			self.log.debug("Answer of Request Access Token: " + Buffer.concat(chunks).toString());
			if (!isValidJSONString(Buffer.concat(chunks).toString())){
				self.log.error("Delivered SRF-JSON is not valid: " + Buffer.concat(chunks).toString());
				self.log.error("Possible cause is an incorrectly configured adapter. Please check configuration. If error persists, create an issue on https://github.com/baerengraben/ioBroker.swiss-weather-api.");
				self.setState('info.connection', false, true);
				return;
			}
			var body = JSON.parse(Buffer.concat(chunks).toString());
			if (typeof body.access_token === undf || body.access_token == null) {
				self.log.warn("Got no Token - Is Adapter correctly configured (ConsumerKey/ConsumerSecret)? It may also be that the maximum number of queries for today is exhausted");
				self.setState('info.connection', false, true);
				return;
			} else if (body.access_token === ""){
				self.log.warn("Got an empty Token - It may be that the maximum number of queries for today is exhausted");
				self.setState('info.connection', false, true);
				return;
			}
			access_token = body.access_token.toString();
			self.log.debug("Access_Token : " + access_token);
			myCallback(self,getForecast);
		});
		res.on("error", function (error) {
			self.setState('info.connection', false, true);
			self.log.error(error)
		});
	});
	req.end();
}

/**
 * Sets the current hour objects with the corresponding values of forecast.60minutes.day0
 * @param self Adapter
 */
function setCurrentHour(self){
	self.log.info('update current hour...');

	// update current_hour objects
	function updateVariables() {
		var promise = new Promise((resolve, reject) => {
			self.log.debug('Defining local current_hour variables...');
			let path = self.namespace + ".forecast.60minutes.day0"

			//get systemtime hour
			var date = new Date();
			var hour = (date.getHours()<10?'0':'') + date.getHours();
			let currentHourVariables = {};
			Object.assign(currentHourVariables, {local_background_color: "dummycolor"});
			Object.assign(currentHourVariables, {local_temperature     : 0});
			Object.assign(currentHourVariables, {local_text_color      : "dummycolor"});
			Object.assign(currentHourVariables, {local_DD_DEG          : 0});
			Object.assign(currentHourVariables, {local_FF_KMH          : 0});
			Object.assign(currentHourVariables, {local_FX_KMH          : 0});
			Object.assign(currentHourVariables, {local_ICON_URL_COLOR  : "dummyicon"});
			Object.assign(currentHourVariables, {local_ICON_URL_DARK   : "dummyicon"});
			Object.assign(currentHourVariables, {local_ICON_URL_LIGHT  : "dummyicon"});
			Object.assign(currentHourVariables, {local_PROBPCP_PERCENT : 0});
			Object.assign(currentHourVariables, {local_RRR_MM          : 0});
			Object.assign(currentHourVariables, {local_SYMBOL_CODE     : 0});
			Object.assign(currentHourVariables, {local_TTH_C           : 0});
			Object.assign(currentHourVariables, {local_TTL_C           : 0});
			Object.assign(currentHourVariables, {local_TTT_C           : 0});
			Object.assign(currentHourVariables, {local_local_date_time : "1970-01-01T00:00:00+02:00"});
			Object.assign(currentHourVariables, {local_type            : "dummytype"});

			self.log.debug('Updating local current_hour variables...');
			self.getState(path + '.0000.DD_DEG', (err, state) => {
				if (!state || state.val === null) {
					self.log.debug('tried to update current_hour, but no forecast data is available for ' + path + '.0000.DD_DEG' + '. Try my luck on next hour...');
				} else {
					(function(next) {
						self.log.debug('forecast data is available. State.val is: ' + state.val + ': So updating current_hour...read correspondenting hour forecast from ' +
							'swiss-weather-api.0.forecast.60minutes.day0.actual_hour and write it to swiss-weather-api.0.forecast.current_hour');

						self.getState(path + '.' + hour + '00.cur_color.background_color', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_background_color = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.cur_color.background_color' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.cur_color.temperature', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_temperature = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.cur_color.temperature' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.cur_color.text_color', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_text_color = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.cur_color.text_color' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.DD_DEG', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_DD_DEG = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.DD_DEG' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.FF_KMH', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_FF_KMH = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.FF_KMH' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.FX_KMH', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_FX_KMH = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.FX_KMH' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.ICON_URL_COLOR', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_ICON_URL_COLOR = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.ICON_URL_COLOR' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.ICON_URL_DARK', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_ICON_URL_DARK = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.ICON_URL_DARK' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.ICON_URL_LIGHT', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_ICON_URL_LIGHT = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.ICON_URL_LIGHT' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.PROBPCP_PERCENT', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_PROBPCP_PERCENT = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.PROBPCP_PERCENT' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.RRR_MM', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_RRR_MM = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.RRR_MM' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.SYMBOL_CODE', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_SYMBOL_CODE = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.SYMBOL_CODE' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.TTH_C', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_TTH_C = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.TTH_C' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.TTL_C', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_TTL_C = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.TTL_C' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.TTT_C', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_TTT_C = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.TTT_C' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.local_date_time', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_local_date_time = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.local_date_time' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						self.getState(path + '.' + hour + '00.type', function (err, state) {
							if ((typeof state !== "undefined") && (state !== null)) {
								currentHourVariables.local_type = state.val;
							} else {
								self.log.info(path + '.' + hour + '00.type' + ':' + 'This should not happen. State is undefined or null. So in this run no data is copied for this value');
							}
						});
						next()
					}(function() {
						resolve(currentHourVariables);
					}))
				}
			})
		})
		return promise;
	}

	async function addCurrentHourObjects() {
		//first do updateVariables() and wait until its finished
		const result= await updateVariables();
		let updatePath = "forecast.current_hour";
		self.log.debug('...and now add current_hour objects.');


		//*** Create current_hour object  ***
		self.setObjectNotExists(updatePath, {
			type: "channel",
			common: {
				name: "Holds the current hour data. This is updated on every full hour by coping the data from forecast.60minutes.day0 - actual hour",
				role: "info"
			},
			native: {},
		});

		self.setObjectNotExists(updatePath + "." + "local_date_time", {
			type: "state",
			common: {
				name: "Date for validity of record",
				type: "string",
				role: "text",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "local_date_time", {
				val: result.local_local_date_time,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "TTT_C", {
			type: "state",
			common: {
				name: "Current temperature in °C",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "TTT_C", {
				val: result.local_TTT_C,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "TTL_C", {
			type: "state",
			common: {
				name: "Error range lower limit",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "TTL_C", {
				val: result.local_TTL_C,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "TTH_C", {
			type: "state",
			common: {
				name: "Error range upper limit",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "TTH_C", {
				val: result.local_TTH_C,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "PROBPCP_PERCENT", {
			type: "state",
			common: {
				name: "Probability of precipitation in %",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "PROBPCP_PERCENT", {
				val: result.local_PROBPCP_PERCENT,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "RRR_MM", {
			type: "state",
			common: {
				name: "Precipitation total",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "RRR_MM", {
				val: result.local_RRR_MM,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "FF_KMH", {
			type: "state",
			common: {
				name: "Wind speed in km/h",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "FF_KMH", {
				val: result.local_FF_KMH,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "FX_KMH", {
			type: "state",
			common: {
				name: "Peak wind speed in km/h",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "FX_KMH", {
				val: result.local_FX_KMH,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "DD_DEG", {
			type: "state",
			common: {
				name: "Wind direction in angular degrees: 0 = North wind",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "DD_DEG", {
				val: result.local_DD_DEG,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "SYMBOL_CODE", {
			type: "state",
			common: {
				name: "Mapping to weather icon",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "SYMBOL_CODE", {
				val: result.local_SYMBOL_CODE,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "ICON_URL_COLOR", {
			type: "state",
			common: {
				name: "URL to color Icon",
				type: "string",
				role: "weather.icon"
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "ICON_URL_COLOR", {
				val: result.local_ICON_URL_COLOR,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "ICON_URL_DARK", {
			type: "state",
			common: {
				name: "URL to dark Icon",
				type: "string",
				role: "weather.icon"
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "ICON_URL_DARK", {
				val: result.local_ICON_URL_DARK,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "ICON_URL_LIGHT", {
			type: "state",
			common: {
				name: "URL to light Icon",
				type: "string",
				role: "weather.icon"
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "ICON_URL_LIGHT", {
				val: result.local_ICON_URL_LIGHT,
				ack: true
			});
		});

		self.setObjectNotExists(updatePath + "." + "type", {
			type: "state",
			common: {
				name: "result set; possible values: 60minutes, hour, day",
				type: "string",
				role: "text",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "type", {
				val: result.local_type,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "cur_color", {
			type: "channel",
			common: {
				name: "Mapping temperature / color value",
				role: "info"
			},
			native: {},
		});
		self.setObjectNotExists(updatePath + "." + "cur_color." + "temperature", {
			type: "state",
			common: {
				name: "Temperature value",
				type: "number",
				role: "value",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "cur_color." + "temperature", {
				val: result.local_temperature,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "cur_color." + "background_color", {
			type: "state",
			common: {
				name: "background hex color value",
				type: "string",
				role: "text",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "cur_color." + "background_color", {
				val: result.local_background_color,
				ack: true
			});
		});
		self.setObjectNotExists(updatePath + "." + "cur_color." + "text_color", {
			type: "state",
			common: {
				name: "text hex color value",
				type: "string",
				role: "text",
				write: false
			},
			native: {},
		}, function () {
			self.setState(updatePath + "." + "cur_color." + "text_color", {
				val: result.local_text_color,
				ack: true
			});
		});
	}

	addCurrentHourObjects();
}

/**
 * Get Forecast by Rest-Calling SRF Weather API
 * @param self Adapter
 */
function getForecast(self){
	self.log.debug("Getting Forecast for geolocation id: " + geolocationId);

	today = new Date();
	// @ts-ignore
	today1 = new Date().addDays(1);
	// @ts-ignore
	today2 = new Date().addDays(2);
	// @ts-ignore
	today3 = new Date().addDays(3);
	// @ts-ignore
	today4 = new Date().addDays(4);
	// @ts-ignore
	today5 = new Date().addDays(5);
	// @ts-ignore
	today6 = new Date().addDays(6);
	// @ts-ignore
	today7 = new Date().addDays(7);
	lastSuccessfulRun = getActualDateFormattet(today);

	//Get forecast
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
			if (!isValidJSONString(Buffer.concat(chunks).toString())){
				self.log.error("Delivered SRF-JSON is not valid: " + Buffer.concat(chunks).toString());
				self.log.error("Possible cause is an incorrectly configured adapter. Please check configuration. If error persists, create an issue on https://github.com/baerengraben/ioBroker.swiss-weather-api.");
				self.setState('info.connection', false, true);
				return;
			}
			var body = JSON.parse(Buffer.concat(chunks).toString());

			//check if there is a Error-Code
			if (body.hasOwnProperty("code")) {
				self.log.debug("Return Code: " + body.code.toString());
				if (body.code.toString().startsWith("404")) {
					self.setState('info.connection', false, true);
					self.log.error("Forecast - Resource not found");
					return;
				} else if (body.code.toString().startsWith("400")) {
					self.setState('info.connection', false, true);
					self.log.error("Forecast -  Invalid request");
					self.log.error("Forecast  - An error has occured. " + JSON.stringify(body));
					return;
				} else if (body.code.toString().startsWith("401")) {
					self.setState('info.connection', false, true);
					self.log.error("Forecast -  Invalid or expired access token ");
					self.log.error("Forecast  - An error has occured. " + JSON.stringify(body));
					return;
				} else if (body.code.toString().startsWith("429")) {
					self.setState('info.connection', false, true);
					self.log.error("Forecast -  Invalid or expired access token ");
					self.log.error("Forecast  - An error has occured. " + JSON.stringify(body));
					return;
				} else {
					self.setState('info.connection', false, true);
					self.log.error("Forecast - An error has occured. " + JSON.stringify(body));
					return;
				}
			}  else if (body.hasOwnProperty("fault")){
				self.setState('info.connection', false, true);
				self.log.error("A fault was delivered by SRF: " + JSON.stringify(body));
				return;
			}

			//**************************************
			//*** Start extract forcast informations
			//**************************************
			if (typeof body.geolocation.id !== undf || body.geolocation.id != null) {
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
			}
			if (typeof body.geolocation.lat !== undf || body.geolocation.lat != null) {
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
			}
			if (typeof body.geolocation.lon !== undf || body.geolocation.lon != null) {
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
			}
			if (typeof body.geolocation.station_id !== undf || body.geolocation.station_id != null) {
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
			}
			if (typeof body.geolocation.timezone !== undf || body.geolocation.timezone != null) {
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
			}
			if (typeof body.geolocation.default_name !== undf || body.geolocation.default_name != null) {
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
			}
			if (typeof body.geolocation.alarm_region_id !== undf || body.geolocation.alarm_region_id != null) {
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
			}
			if (typeof body.geolocation.alarm_region_name !== undf || body.geolocation.alarm_region_name != null) {
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
			}
			if (typeof body.geolocation.district !== undf || body.geolocation.district != null) {
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
			}

			//Geolocation_Names
			if (typeof body.geolocation.geolocation_names[0].district !== undf || body.geolocation.geolocation_names[0].district != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].id !== undf || body.geolocation.geolocation_names[0].id != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].type !== undf || body.geolocation.geolocation_names[0].type != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].language !== undf || body.geolocation.geolocation_names[0].language != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].translation_type !== undf || body.geolocation.geolocation_names[0].translation_type != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].name !== undf || body.geolocation.geolocation_names[0].name != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].country !== undf || body.geolocation.geolocation_names[0].country != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].province !== undf || body.geolocation.geolocation_names[0].province != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].inhabitants !== undf || body.geolocation.geolocation_names[0].inhabitants != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].height !== undf || body.geolocation.geolocation_names[0].height != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].plz !== undf || body.geolocation.geolocation_names[0].plz != null) {
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
			}
			if (typeof body.geolocation.geolocation_names[0].ch !== undf || body.geolocation.geolocation_names[0].ch != null) {
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
			}

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


			if (typeof body.forecast["60minutes"] !== undf || body.forecast["60minutes"] != null) {
				//iterate over all 60minutes objects
				body.forecast["60minutes"].forEach(function (obj, index) {
					var startTimeISOString;
					var objDate;
					var myPath;
					var myTime;

					if (typeof obj.local_date_time !== undf || obj.local_date_time != null) {
						startTimeISOString = obj.local_date_time;
						objDate = new Date(startTimeISOString);
						myTime = getTimeFormattet(objDate);
					} else {
						self.log.error("No local_date_time found in JSON, delivered by SRF. Please try again later.");
						return;
					}

					if (index < 24) {
						myPath = "day0";
					} else if (index > 23 && index < 48) {
						myPath = "day1";
					} else if (index > 47 && index < 72) {
						myPath = "day2";
					} else if (index > 71 && index < 96) {
						myPath = "day3";
					} else if (index > 95) {
						myPath = "day4";
					} else {
						self.setState('info.connection', false, true);
						self.log.error("This should never happen. Please rerun adapter with debug-level and report it on https://github.com/baerengraben/ioBroker.swiss-weather-api/issues");
						return;
					}

					if (typeof obj.local_date_time !== undf || obj.local_date_time != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "local_date_time", {
							type: "state",
							common: {
								name: "Date for validity of record",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "local_date_time", {
								val: obj.local_date_time,
								ack: true
							});
						});
					}
					if (typeof obj.TTT_C !== undf || obj.TTT_C != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "TTT_C", {
							type: "state",
							common: {
								name: "Current temperature in °C",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "TTT_C", {
								val: obj.TTT_C,
								ack: true
							});
						});
					}
					if (typeof obj.TTL_C !== undf || obj.TTL_C != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "TTL_C", {
							type: "state",
							common: {
								name: "Error range lower limit",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "TTL_C", {
								val: obj.TTL_C,
								ack: true
							});
						});
					}
					if (typeof obj.TTH_C !== undf || obj.TTH_C != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "TTH_C", {
							type: "state",
							common: {
								name: "Error range upper limit",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "TTH_C", {
								val: obj.TTH_C,
								ack: true
							});
						});
					}
					if (typeof obj.PROBPCP_PERCENT !== undf || obj.PROBPCP_PERCENT != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "PROBPCP_PERCENT", {
							type: "state",
							common: {
								name: "Probability of precipitation in %",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "PROBPCP_PERCENT", {
								val: obj.PROBPCP_PERCENT,
								ack: true
							});
						});
					}
					if (typeof obj.RRR_MM !== undf || obj.RRR_MM != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "RRR_MM", {
							type: "state",
							common: {
								name: "Precipitation total",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "RRR_MM", {
								val: obj.RRR_MM,
								ack: true
							});
						});
					}
					if (typeof obj.FF_KMH !== undf || obj.FF_KMH != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "FF_KMH", {
							type: "state",
							common: {
								name: "Wind speed in km/h",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "FF_KMH", {
								val: obj.FF_KMH,
								ack: true
							});
						});
					}
					if (typeof obj.FX_KMH !== undf || obj.FX_KMH != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "FX_KMH", {
							type: "state",
							common: {
								name: "Peak wind speed in km/h",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "FX_KMH", {
								val: obj.FX_KMH,
								ack: true
							});
						});
					}
					if (typeof obj.DD_DEG !== undf || obj.DD_DEG != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "DD_DEG", {
							type: "state",
							common: {
								name: "Wind direction in angular degrees: 0 = North wind",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "DD_DEG", {
								val: obj.DD_DEG,
								ack: true
							});
						});
					}
					if (typeof obj.SYMBOL_CODE !== undf || obj.SYMBOL_CODE != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "SYMBOL_CODE", {
							type: "state",
							common: {
								name: "Mapping to weather icon",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "SYMBOL_CODE", {
								val: obj.SYMBOL_CODE,
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "ICON_URL_COLOR", {
							type: "state",
							common: {
								name: "URL to color Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "ICON_URL_COLOR", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Color/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "ICON_URL_DARK", {
							type: "state",
							common: {
								name: "URL to dark Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "ICON_URL_DARK", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Dark/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "ICON_URL_LIGHT", {
							type: "state",
							common: {
								name: "URL to light Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "ICON_URL_LIGHT", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Light/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
					}
					if (typeof obj.type !== undf || obj.type != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "type", {
							type: "state",
							common: {
								name: "result set; possible values: 60minutes, hour, day",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "type", {
								val: obj.type,
								ack: true
							});
						});
					}
					self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "cur_color", {
						type: "channel",
						common: {
							name: "Mapping temperature / color value",
							role: "info"
						},
						native: {},
					});
					if (typeof obj.cur_color.temperature !== undf || obj.cur_color.temperature != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "cur_color." + "temperature", {
							type: "state",
							common: {
								name: "Temperature value",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "cur_color." + "temperature", {
								val: obj.cur_color.temperature,
								ack: true
							});
						});
					}
					if (typeof obj.cur_color.background_color !== undf || obj.cur_color.background_color != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "cur_color." + "background_color", {
							type: "state",
							common: {
								name: "background hex color value",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "cur_color." + "background_color", {
								val: obj.cur_color.background_color,
								ack: true
							});
						});
					}
					if (typeof obj.cur_color.text_color !== undf || obj.cur_color.text_color != null) {
						self.setObjectNotExists("forecast." + "60minutes." + myPath + "." + myTime + "." + "cur_color." + "text_color", {
							type: "state",
							common: {
								name: "text hex color value",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes." + myPath + "." + myTime + "." + "cur_color." + "text_color", {
								val: obj.cur_color.text_color,
								ack: true
							});
						});
					}

					var jsonCharts = (createJson(body));
					jsonCharts.forEach(function (obj, index) {
						self.setObjectNotExists("forecast." + "60minutes.day" + index + "." + "JsonChart", {
							type: "state",
							common: {
								name: "JSON containing the weather-values of this 60min forecast - Use this with Material Design JSON Chart",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "60minutes.day" + index + "." + "JsonChart", {
								val: JSON.stringify(obj),
								ack: true
							});
						});
					});
				});
			} else {
				self.log.error("No 60minutes Forecast-Data found in JSON delivered by SRF. Please try again later.");
			}


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
			if (typeof body.forecast["day"] !== undf || body.forecast["day"] != null) {
				body.forecast["day"].forEach(function (obj, index) {
					var startTimeISOString = obj.local_date_time;
					var objDate = new Date(startTimeISOString);
					var myPath;
					var myTime = getTimeFormattet(objDate);
					var day_name = "";

					if (index === 0) {
						myPath = "day0";
						day_name = getDayName(today, self.defaultLanguage);
					} else if (index === 1) {
						myPath = "day1";
						day_name = getDayName(today1, self.defaultLanguage);
					} else if (index === 2) {
						myPath = "day2";
						day_name = getDayName(today2, self.defaultLanguage);
					} else if (index === 3) {
						myPath = "day3";
						day_name = getDayName(today3, self.defaultLanguage);
					} else if (index === 4) {
						myPath = "day4";
						day_name = getDayName(today4, self.defaultLanguage);
					} else if (index === 5) {
						myPath = "day5";
						day_name = getDayName(today5, self.defaultLanguage);
					} else if (index === 6) {
						myPath = "day6";
						day_name = getDayName(today6, self.defaultLanguage);
					} else if (index === 7) {
						myPath = "day7";
						day_name = getDayName(today7, self.defaultLanguage);
					} else {
						self.setState('info.connection', false, true);
						self.log.error("This should never happen. Please rerun adapter with debug-level and report it on https://github.com/baerengraben/ioBroker.swiss-weather-api/issues");
						return;
					}
					self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "day_name", {
						type: "state",
						common: {
							name: "Day Name",
							type: "string",
							role: "text"
						},
						native: {},
					}, function () {
						self.setState("forecast." + "day." + myPath + "." + myTime + "." + "day_name", {
							val: day_name,
							ack: true
						});
					}.bind({day_name: day_name}));
					if (typeof obj.local_date_time !== undf || obj.local_date_time != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "local_date_time", {
							type: "state",
							common: {
								name: "Date for validity of record",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "local_date_time", {
								val: obj.local_date_time,
								ack: true
							});
						});
					}
					if (typeof obj.TX_C !== undf || obj.TX_C != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "TX_C", {
							type: "state",
							common: {
								name: "Maximum temperature in °C",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "TX_C", {
								val: obj.TX_C,
								ack: true
							});
						});
					}
					if (typeof obj.TN_C !== undf || obj.TN_C != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "TN_C", {
							type: "state",
							common: {
								name: "Lowest temperature in °C",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "TN_C", {
								val: obj.TN_C,
								ack: true
							});
						});
					}
					if (typeof obj.PROBPCP_PERCENT !== undf || obj.PROBPCP_PERCENT != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "PROBPCP_PERCENT", {
							type: "state",
							common: {
								name: "Probability of precipitation in %",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "PROBPCP_PERCENT", {
								val: obj.PROBPCP_PERCENT,
								ack: true
							});
						});
					}
					if (typeof obj.RRR_MM !== undf || obj.RRR_MM != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "RRR_MM", {
							type: "state",
							common: {
								name: "Precipitation total",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "RRR_MM", {
								val: obj.RRR_MM,
								ack: true
							});
						});
					}
					if (typeof obj.FF_KMH !== undf || obj.FF_KMH != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "FF_KMH", {
							type: "state",
							common: {
								name: "Wind speed in km/h",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "FF_KMH", {
								val: obj.FF_KMH,
								ack: true
							});
						});
					}
					if (typeof obj.FX_KMH !== undf || obj.FX_KMH != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "FX_KMH", {
							type: "state",
							common: {
								name: "Peak wind speed in km/h",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "FX_KMH", {
								val: obj.FX_KMH,
								ack: true
							});
						});
					}
					if (typeof obj.DD_DEG !== undf || obj.DD_DEG != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "DD_DEG", {
							type: "state",
							common: {
								name: "Wind direction in angular degrees: 0 = North wind",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "DD_DEG", {
								val: obj.DD_DEG,
								ack: true
							});
						});
					}
					if (typeof obj.SUNSET !== undf || obj.SUNSET != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "SUNSET", {
							type: "state",
							common: {
								name: "Time sunset",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "SUNSET", {
								val: obj.SUNSET,
								ack: true
							});
						});
					}
					if (typeof obj.SUNRISE !== undf || obj.SUNRISE != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "SUNRISE", {
							type: "state",
							common: {
								name: "Time sunrise",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "SUNRISE", {
								val: obj.SUNRISE,
								ack: true
							});
						});
					}
					if (typeof obj.SUN_H !== undf || obj.SUN_H != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "SUN_H", {
							type: "state",
							common: {
								name: "Sun hours",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "SUN_H", {
								val: obj.SUN_H,
								ack: true
							});
						});
					}
					if (typeof obj.SYMBOL_CODE !== undf || obj.SYMBOL_CODE != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "SYMBOL_CODE", {
							type: "state",
							common: {
								name: "Mapping to weather icon",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "SYMBOL_CODE", {
								val: obj.SYMBOL_CODE,
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "ICON_URL_COLOR", {
							type: "state",
							common: {
								name: "URL to color Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "ICON_URL_COLOR", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Color/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "ICON_URL_DARK", {
							type: "state",
							common: {
								name: "URL to dark Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "ICON_URL_DARK", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Dark/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "ICON_URL_LIGHT", {
							type: "state",
							common: {
								name: "URL to light Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "ICON_URL_LIGHT", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Light/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
					}
					if (typeof obj.type !== undf || obj.type != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "type", {
							type: "state",
							common: {
								name: "result set; possible values: 60minutes, hour, day",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "type", {
								val: obj.type,
								ack: true
							});
						});
					}
					self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "min_color", {
						type: "channel",
						common: {
							name: "Mapping temperature / color value",
							role: "info"
						},
						native: {},
					});
					if (typeof obj.min_color.temperature !== undf || obj.min_color.temperature != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "min_color." + "temperature", {
							type: "state",
							common: {
								name: "temperature",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "min_color." + "temperature", {
								val: obj.min_color.temperature,
								ack: true
							});
						});
					}
					if (typeof obj.min_color.background_color !== undf || obj.min_color.background_color != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "min_color." + "background_color", {
							type: "state",
							common: {
								name: "background color",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "min_color." + "background_color", {
								val: obj.min_color.background_color,
								ack: true
							});
						});
					}
					if (typeof obj.min_color.text_color !== undf || obj.min_color.text_color != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "min_color." + "text_color", {
							type: "state",
							common: {
								name: "text color",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "min_color." + "text_color", {
								val: obj.min_color.text_color,
								ack: true
							});
						});
					}
					self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "max_color", {
						type: "channel",
						common: {
							name: "Mapping temperature / color value",
							role: "info"
						},
						native: {},
					});
					if (typeof obj.max_color.temperature !== undf || obj.max_color.temperature != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "max_color." + "temperature", {
							type: "state",
							common: {
								name: "temperature",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "max_color." + "temperature", {
								val: obj.max_color.temperature,
								ack: true
							});
						});
					}
					if (typeof obj.max_color.background_color !== undf || obj.max_color.background_color != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "max_color." + "background_color", {
							type: "state",
							common: {
								name: "background color",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "max_color." + "background_color", {
								val: obj.max_color.background_color,
								ack: true
							});
						});
					}
					if (typeof obj.max_color.text_color !== undf || obj.max_color.text_color != null) {
						self.setObjectNotExists("forecast." + "day." + myPath + "." + myTime + "." + "max_color." + "text_color", {
							type: "state",
							common: {
								name: "text color",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "day." + myPath + "." + myTime + "." + "max_color." + "text_color", {
								val: obj.max_color.text_color,
								ack: true
							});
						});
					}
				});
			} else {
				self.log.error("No day Forecast-Data found in JSON delivered by SRF. Please try again later.");
			}

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
			if (typeof body.forecast["hour"] !== undf || body.forecast["hour"] != null) {
				//iterate over all hour objects
				body.forecast["hour"].forEach(function (obj, index) {
					var startTimeISOString = obj.local_date_time;
					var objDate = new Date(startTimeISOString);
					var myPath;
					var myTime = getTimeFormattet(objDate);

					if (index < 8) {
						myPath = "day0";
					} else if (index > 7 && index < 16) {
						myPath = "day1";
					} else if (index > 15 && index < 24) {
						myPath = "day2";
					} else if (index > 23 && index < 32) {
						myPath = "day3";
					} else if (index > 31 && index < 40) {
						myPath = "day4";
					} else if (index > 39 && index < 48) {
						myPath = "day5";
					} else if (index > 47 && index < 56) {
						myPath = "day6";
					} else if (index > 55 && index < 64) {
						myPath = "day7";
					} else {
						self.setState('info.connection', false, true);
						self.log.error("This should never happen. Please rerun adapter with debug-level and report it on https://github.com/baerengraben/ioBroker.swiss-weather-api/issues");
						return;
					}

					if (typeof obj.local_date_time !== undf || obj.local_date_time != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "local_date_time", {
							type: "state",
							common: {
								name: "Date for validity of record",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "local_date_time", {
								val: obj.local_date_time,
								ack: true
							});
						});
					}
					if (typeof obj.TTT_C !== undf || obj.TTT_C != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "TTT_C", {
							type: "state",
							common: {
								name: "Current temperature in °C",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "TTT_C", {
								val: obj.TTT_C,
								ack: true
							});
						});
					}
					if (typeof obj.TTL_C !== undf || obj.TTL_C != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "TTL_C", {
							type: "state",
							common: {
								name: "Error range lower limit",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "TTL_C", {
								val: obj.TTL_C,
								ack: true
							});
						});
					}
					if (typeof obj.TTH_C !== undf || obj.TTH_C != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "TTH_C", {
							type: "state",
							common: {
								name: "Error range upper limit",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "TTH_C", {
								val: obj.TTH_C,
								ack: true
							});
						});
					}
					if (typeof obj.PROBPCP_PERCENT !== undf || obj.PROBPCP_PERCENT != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "PROBPCP_PERCENT", {
							type: "state",
							common: {
								name: "Probability of precipitation in %",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "PROBPCP_PERCENT", {
								val: obj.PROBPCP_PERCENT,
								ack: true
							});
						});
					}
					if (typeof obj.RRR_MM !== undf || obj.RRR_MM != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "RRR_MM", {
							type: "state",
							common: {
								name: "Precipitation total",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "RRR_MM", {
								val: obj.RRR_MM,
								ack: true
							});
						});
					}
					if (typeof obj.FF_KMH !== undf || obj.FF_KMH != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "FF_KMH", {
							type: "state",
							common: {
								name: "Wind speed in km/h",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "FF_KMH", {
								val: obj.FF_KMH,
								ack: true
							});
						});
					}
					if (typeof obj.FX_KMH !== undf || obj.FX_KMH != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "FX_KMH", {
							type: "state",
							common: {
								name: "Peak wind speed in km/h",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "FX_KMH", {
								val: obj.FX_KMH,
								ack: true
							});
						});
					}
					if (typeof obj.DD_DEG !== undf || obj.DD_DEG != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "DD_DEG", {
							type: "state",
							common: {
								name: "Wind direction in angular degrees: 0 = North wind",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "DD_DEG", {
								val: obj.DD_DEG,
								ack: true
							});
						});
					}
					if (typeof obj.SYMBOL_CODE !== undf || obj.SYMBOL_CODE != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "SYMBOL_CODE", {
							type: "state",
							common: {
								name: "Mapping to weather icon",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "SYMBOL_CODE", {
								val: obj.SYMBOL_CODE,
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "ICON_URL_COLOR", {
							type: "state",
							common: {
								name: "URL to color Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "ICON_URL_COLOR", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Color/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "ICON_URL_DARK", {
							type: "state",
							common: {
								name: "URL to dark Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "ICON_URL_DARK", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Dark/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "ICON_URL_LIGHT", {
							type: "state",
							common: {
								name: "URL to light Icon",
								type: "string",
								role: "weather.icon"
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "ICON_URL_LIGHT", {
								val: "https://raw.githubusercontent.com/baerengraben/ioBroker.swiss-weather-api/master/img/Meteo_API_Icons/Light/" + obj.SYMBOL_CODE + ".png",
								ack: true
							});
						});
					}
					if (typeof obj.type !== undf || obj.type != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "type", {
							type: "state",
							common: {
								name: "result set; possible values: 60minutes, hour, day",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "type", {
								val: obj.type,
								ack: true
							});
						});
					}
					self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "cur_color", {
						type: "channel",
						common: {
							name: "Mapping temperature / color value",
							role: "info"
						},
						native: {},
					});
					if (typeof obj.cur_color.temperature !== undf || obj.cur_color.temperature != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "cur_color." + "temperature", {
							type: "state",
							common: {
								name: "Temperature value",
								type: "number",
								role: "value",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "cur_color." + "temperature", {
								val: obj.cur_color.temperature,
								ack: true
							});
						});
					}
					if (typeof obj.cur_color.background_color !== undf || obj.cur_color.background_color != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "cur_color." + "background_color", {
							type: "state",
							common: {
								name: "background hex color value",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "cur_color." + "background_color", {
								val: obj.cur_color.background_color,
								ack: true
							});
						});
					}
					if (typeof obj.cur_color.text_color !== undf || obj.cur_color.text_color != null) {
						self.setObjectNotExists("forecast." + "hour." + myPath + "." + myTime + "." + "cur_color." + "text_color", {
							type: "state",
							common: {
								name: "text hex color value",
								type: "string",
								role: "text",
								write: false
							},
							native: {},
						}, function () {
							self.setState("forecast." + "hour." + myPath + "." + myTime + "." + "cur_color." + "text_color", {
								val: obj.cur_color.text_color,
								ack: true
							});
						});
					}

					//Set last Sucessfull run
					self.setObjectNotExists("info.lastrun", {
						type: "state",
						common: {
							name: "Last successful run",
							type: "string",
							role: "text",
							write: false
						},
						native: {},
					}, function () {
						self.setState("info.lastrun", {
							val: lastSuccessfulRun,
							ack: true
						});
					}.bind({lastSuccessfulRun: lastSuccessfulRun}));
				});
			} else {
				self.log.error("No hour Forecast-Data found in JSON delivered by SRF. Please try again later.");
			}

		});
		res.on("error", function (error) {
			self.setState('info.connection', false, true);
			self.log.error(error)
		});
	});
	req.end();
	//we have to wait before updating currenthour Objects.
	//Instead of going to callback hell, just wait 20s.
	// => not a problem if https.request is not finished. In this case, currentHour will be set on every hour (cron)
	setTimeout(setCurrentHour, 20000, self);
}

/**
 * Get Geolocation by Rest-Calling SRF Weather API
 * @param self Adapter
 * @param myCallback Callback
 */
function getGeolocationId(self,myCallback) {
	self.log.debug("Getting GeolocationId....");
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
			if (!isValidJSONString(Buffer.concat(chunks).toString())){
				self.log.error("Delivered SRF-JSON is not valid: " + Buffer.concat(chunks).toString());
				self.log.error("Possible cause is an incorrectly configured adapter. Please check configuration. If error persists, create an issue on https://github.com/baerengraben/ioBroker.swiss-weather-api.");
				self.setState('info.connection', false, true);
				return;
			}

			var body = JSON.parse(Buffer.concat(chunks).toString());
			self.log.debug("Body: " + JSON.stringify(body));

			//check if there is a Error-Code
			if (body.hasOwnProperty("code")) {
				self.log.debug("Return Code: " + body.code.toString());
				if (body.code.toString().startsWith("404")) {
					self.setState('info.connection', false, true);
					self.log.error("Get Gelocation id - Resource not found");
					return;
				} else if (body.code.toString().startsWith("400")) {
					self.setState('info.connection', false, true);
					self.log.error("Get Gelocation id -  Invalid request");
					self.log.error("Get Gelocation id  - An error has occured. " + JSON.stringify(body));
					return;
				} else if (body.code.toString().startsWith("401")) {
					self.setState('info.connection', false, true);
					self.log.error("Get Gelocation id -  Invalid or expired access token ");
					self.log.error("Get Gelocation id  - An error has occured. " + JSON.stringify(body));
					return;
				} else if (body.code.toString().startsWith("429")) {
					self.setState('info.connection', false, true);
					self.log.error("Get Gelocation id -  Invalid or expired access token ");
					self.log.error("Get Gelocation id  - An error has occured. " + JSON.stringify(body));
					return;
				} else {
					self.setState('info.connection', false, true);
					self.log.error("Get Gelocation id - An error has occured. " + JSON.stringify(body));
					return;
				}
			} else if (body.hasOwnProperty("fault")){
				self.setState('info.connection', false, true);
				self.log.error("A fault was delivered by SRF: " + JSON.stringify(body));
				return;
			}

			//Extract GeolocationID
			if (typeof body[0].id === undf || body[0].id == null) {
				self.setState('info.connection', false, true);
				self.log.error("Could not get a geolocation id. Is the adapter configured cleanly? Please note that from version 0.9.x a new App must be created under the SRG-SSR Developer portal ('freemium' subscription is needed). Please check readme for more details https://github.com/baerengraben/ioBroker.swiss-weather-api/blob/master/README.md" + JSON.stringify(body));
			} else {
				geolocationId = body[0].id.toString();
				//getForecast
				myCallback(self);
			}
		});
		res.on("error", function (error) {
			self.setState('info.connection', false, true);
			self.log.error(error)
		});
	});
	req.end();
}

/**
 * Main-Method holds the full get forecast magic.
 * @param self
 */
function doIt(self) {
	self.setState('info.connection', true, true);
	var pollInterval = self.config.PollInterval * 60000; //Convert minute to miliseconds
	//First of all check if there is a working DNS-Resolver
	//Resolves https://github.com/baerengraben/ioBroker.swiss-weather-api/issues/32
	dns.resolve4('api.srgssr.ch', function (err, addresses) {
		if (err) {
			self.log.error('DNS Resolve Failed for api.srgssr.ch: ' + err.message + ' Is there an internet connection?');
			self.log.error('Retrying in 10min...');
			self.setState('info.connection', false, true);
			setTimeout(doIt, 10 * 60000, self);
		} else {
			self.log.debug('Successfull DNS resolve for api.srgssr.ch: ' + JSON.stringify(addresses));
			self.setState('info.connection', true, true);

			// Check if there is already a geolocationId, if not => Get one
			if (geolocationId) {
				self.log.debug("geolocationId is available, move forwared to get forcasts...");
				getToken(self,getForecast);
			} else {
				self.log.debug("There is no geolocationId, so getting one before calling forecasts...");
				getToken(self,getGeolocationId);
			}
			setTimeout(doIt, pollInterval, self);
		}
	});
}

class SwissWeatherApi extends utils.Adapter {
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		// @ts-ignore
		super({
			...options,
			name: adapterName,
		});
		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		//set state to 'ok'
		this.setState('info.connection', true, true);
		//ensure that current_hour is uptodate on every minute '0'
		cronJob = cron.schedule('0 * * * *', async() => {
			setCurrentHour(this);
		});
		// read system Longitude, Latitude and language
		getSystemData(this);
		getSystemLanguage(this);
		//to and get some forecast
		setTimeout(doIt, 10000, this); // First start after 10s
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param  callback
	 */
	onUnload(callback) {
		try {
			if(cronJob) {
				cronJob.stop();
				this.log.debug('Cron job destroyed');
			}

			clearTimeout(timeout);
			this.log.info("cleaned everything up...");
			callback();
		} catch (e) {
			this.log.error(`Unload error (${e.stack})`);
			callback();
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
