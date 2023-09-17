
function SendRequest() {
    var idVis = '0_userdata.0.chart'; // Für Vis

    var json

    var sun0 = getState('swiss-weather-api.0.forecast.days.day0.0000.SUN_H'/*Sun hours*/).val;
    var sun1 = getState('swiss-weather-api.0.forecast.days.day1.0000.SUN_H'/*Sun hours*/).val;
    var sun2 = getState('swiss-weather-api.0.forecast.days.day2.0000.SUN_H'/*Sun hours*/).val;
    var sun3 = getState('swiss-weather-api.0.forecast.days.day3.0000.SUN_H'/*Sun hours*/).val;
    var sun4 = getState('swiss-weather-api.0.forecast.days.day4.0000.SUN_H'/*Sun hours*/).val;
    var sun5 = getState('swiss-weather-api.0.forecast.days.day5.0000.SUN_H'/*Sun hours*/).val;
    var sun6 = getState('swiss-weather-api.0.forecast.days.day6.0000.SUN_H'/*Sun hours*/).val;
    var sun7 = getState('swiss-weather-api.0.forecast.days.day7.0000.SUN_H'/*Sun hours*/).val;

    var sun = sun0 + "," + sun1 + "," + sun2 + "," + sun3 + "," + sun4 + "," + sun5 + "," + sun6 + "," + sun7

    var rain0 = getState('swiss-weather-api.0.forecast.days.day0.0000.RRR_MM'/*Sun hours*/).val;
    var rain1 = getState('swiss-weather-api.0.forecast.days.day1.0000.RRR_MM'/*Sun hours*/).val;
    var rain2 = getState('swiss-weather-api.0.forecast.days.day2.0000.RRR_MM'/*Sun hours*/).val;
    var rain3 = getState('swiss-weather-api.0.forecast.days.day3.0000.RRR_MM'/*Sun hours*/).val;
    var rain4 = getState('swiss-weather-api.0.forecast.days.day4.0000.RRR_MM'/*Sun hours*/).val;
    var rain5 = getState('swiss-weather-api.0.forecast.days.day5.0000.RRR_MM'/*Sun hours*/).val;
    var rain6 = getState('swiss-weather-api.0.forecast.days.day6.0000.RRR_MM'/*Sun hours*/).val;
    var rain7 = getState('swiss-weather-api.0.forecast.days.day7.0000.RRR_MM'/*Sun hours*/).val;

    var rain = rain0 + "," + rain1 + "," + rain2 + "," + rain3 + "," + rain4 + "," + rain5 + "," + rain6 + "," + rain7

    var wind0 = getState('swiss-weather-api.0.forecast.days.day0.0000.FF_KMH'/*Sun hours*/).val;
    var wind1 = getState('swiss-weather-api.0.forecast.days.day1.0000.FF_KMH'/*Sun hours*/).val;
    var wind2 = getState('swiss-weather-api.0.forecast.days.day2.0000.FF_KMH'/*Sun hours*/).val;
    var wind3 = getState('swiss-weather-api.0.forecast.days.day3.0000.FF_KMH'/*Sun hours*/).val;
    var wind4 = getState('swiss-weather-api.0.forecast.days.day4.0000.FF_KMH'/*Sun hours*/).val;
    var wind5 = getState('swiss-weather-api.0.forecast.days.day5.0000.FF_KMH'/*Sun hours*/).val;
    var wind6 = getState('swiss-weather-api.0.forecast.days.day6.0000.FF_KMH'/*Sun hours*/).val;
    var wind7 = getState('swiss-weather-api.0.forecast.days.day7.0000.FF_KMH'/*Sun hours*/).val;

    var wind = wind0 + "," + wind1 + "," + wind2 + "," + wind3 + "," + wind4 + "," + wind5 + "," + wind6 + "," + wind7

    json = `{
        "axisLabels": [
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],
        "graphs": [
            {
                "type": "line",
                "data": [ ` + rain + ` ],
                "yAxis_id": 0,
                "barIsStacked": false,
                "datalabel_show": false,
                "line_UseFillColor": true,
                "yAxis_show": false,
                "color": "blue"
            },
            {
                "type": "line",
                "data": [ ` + sun + ` ],
                "yAxis_id": 1,
                "barIsStacked": true,
                "datalabel_show": false,
                "line_UseFillColor": true,
                "yAxis_show": false,
                "color": "yellow"
            },
            {
                "type": "line",
                "data": [ ` + wind + ` ],
                "yAxis_id": 2,
                "barIsStacked": true,
                "datalabel_show": false,
                "line_UseFillColor": false,
                "yAxis_show": false,
                "color": "aqua"
            }
    
        ]
    }`

    setState(idVis, json, true);
}

schedule('5 * * * * *', SendRequest);