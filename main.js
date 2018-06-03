/*jslint
    browser, single, multivar, this
*/

/*global
    jQuery, $, google, alert, window, escape, GetUrlKeyValue
*/

/*
    Created by: Michael Vickers
    Declares a "main" module which contains core functions for the SharePoint
    Calls functions for generic features and specific pages
*/

var main = (function () {
    'use strict';

    function formatDate(input) {
        /*  Formats a given date string in EN-GB style (dd/mm/yyyy) into US style (mm/dd/yyyy)
        */
        var datePart = input.match(/\d+/g), year = datePart[2], month = datePart[1], day = datePart[0];
        return month + '/' + day + '/' + year;
    }

    function getWeekName(d) {
        /*  Returns the week name (yyyy-Www) for a given date string
        */
        d = new Date(+d);
        d.setHours(0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        var yearStart = new Date(d.getFullYear(), 0, 1);
        var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return d.getFullYear() + '-W' + ('0' + weekNo).slice(-2);
    }

    function getMonthName(d) {
        /*  Returns the month name (yyyy-mm) for a given date string
        */
        d = new Date(+d);
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    }

    function getDate(d) {
        /*  Returns the date in EN-GB format (dd/mm/yyyy) for a given date string
        */
        d = new Date(+d);

        return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    }

    function getDistinct(values) {
        /*  Returns the and array of unique values contained in a given array
        */
        var seen = [];

        $.each(values, function (ignore, value) {
            if (seen.indexOf(value) === -1) {
                seen.push(value);
            }
            return;
        });

        return seen;
    }

    function displaySconDashboard() {
        /*  Process data needed for the Safety Conversation Dashboard and then displays this in a series of Google charts
        */
        var employeeRows = [];
        var employeeTotalRows = [];

        $('table#\\{25C638BE-5DC3-48A3-958B-0B2AA2551432\\}-\\{6583CBBF-F559-4CF7-B404-C2C431117C5B\\} tr, table#\\{25C638BE-5DC3-48A3-958B-0B2AA2551432\\}-\\{CE14FCA7-8F72-4B49-A1A8-C836D4AD711C\\} tr').not('.ms-viewheadertr').each(function () {
            var $row = $(this);

            var employeenumber = $row.find(':nth-child(1)').text(),
                forename = $row.find(':nth-child(2)').text(),
                surname = $row.find(':nth-child(3)').text(),
                area = $row.find(':nth-child(4)').text(),
                team = $row.find(':nth-child(5)').text(),
                shiftrota = $row.find(':nth-child(6)').text();

            if (employeenumber && forename && surname && area && team && shiftrota) {               /* Table row headers will have one or more empty cells, so ignore them */
                switch (employeenumber.substring(0, 2)) {                                               /* Convert the SAP ID into the Windows AD account username format */
                case '01':
                    employeenumber = 'b' + employeenumber.substring(2);
                    break;
                case '80':
                    employeenumber = 'c' + employeenumber.substring(2);
                    break;
                }

                employeeRows.push({c: [{v: employeenumber}, {v: surname + ', ' + forename}, {v: area}, {v: team}, {v: shiftrota}]});
                employeeTotalRows.push([{v: employeenumber}, {v: surname + ', ' + forename}, {v: area}, {v: team}, {v: shiftrota}, {v: 0}, {v: 0}, {v: 0}]);        /* Create a dummy entry like the employee has performed no scons, for later merging with actual employee totals so that people who've done none are included */
            }
        });

        var employees = new google.visualization.DataTable({
            cols: [
                {id: 'employeenumber', label: 'Person', type: 'string'},
                {id: 'name', label: 'Person', type: 'string'},
                {id: 'area', label: 'Person', type: 'string'},
                {id: 'team', label: 'Person', type: 'string'},
                {id: 'shiftrota', label: 'Person', type: 'string'}
            ],
            rows: employeeRows
        });

        var sconRows = [];

		$('table#\\{F393E7E2-4AA8-41C2-A326-1B8BE0801C81\\}-\\{E0432BF0-8E24-4259-B8F0-B45AE462A07A\\} tr, table#\\{F393E7E2-4AA8-41C2-A326-1B8BE0801C81\\}-\\{910AAE18-B52D-4858-8552-B9F8349379F5\\} tr, table#\\{77910D99-C78E-4A28-A6B4-4B96BB538E14\\}-\\{DD77EC58-D443-406F-8347-93D051EBCE66\\} tr, table#\\{77910D99-C78E-4A28-A6B4-4B96BB538E14\\}-\\{1C8FB065-06FB-4F08-B673-A753B030BC53\\} tr, table#\\{1412BA89-9F71-4A0F-98B4-65000C5E9FBF\\}-\\{593459FE-AB54-4932-920B-2704DA3E2BB7\\} tr, table#\\{1412BA89-9F71-4A0F-98B4-65000C5E9FBF\\}-\\{7AA3F472-A51A-458B-9AB5-3D28EC1D6656\\} tr').not('.ms-viewheadertr').each(function () {
            var $row = $(this);

            var date = $row.find(':nth-child(1)').text(),
                heldby = $row.find(':nth-child(2)').text().trim().toLowerCase().replace(/o/gi, '0'),       /* Standardise B zero format: lower case and convert any "o" to zeros */
                area = $row.find(':nth-child(3)').text() || 'Skinningrove: 1014c',					/* 1014c audits do not have an area so default to Skinningrove */
                involved = $row.find(':nth-child(4)').text() || 1;                                  /* Early SCons didn't have this field and MofW Audits don't either, so default to 1 when it isn't present */

            if (date && heldby && area) {                                                           /* Table row headers will have one or more empty cells, so skip these */
                date = formatDate(date.substring(0, 16));                                               /* Trim date as it repeats twice */
                var scondate = new Date(Date.parse(date)),
                    site = area.split(':')[0];

                if ((/^([b,c][0-9]{6})$/.test(heldby)) === false) {                                    /* Attempt to correct common heldby field formating errors */
					if ((/^(06[0-9]{6})$/.test(heldby)) === true) {
                        heldby = 'b' + heldby.substring(2);
                    }

                    if ((/^(6[0-9]{6})$/.test(heldby)) === true) {
                        heldby = 'b' + heldby.substring(1);
                    }

					if ((/^(01[0-9]{6})$/.test(heldby)) === true) {
                        heldby = 'b' + heldby.substring(2);
                    }

                    if ((/^(1[0-9]{6})$/.test(heldby)) === true) {
                        heldby = 'b' + heldby.substring(1);
                    }

					if ((/^(80[0-9]{6})$/.test(heldby)) === true) {
                        heldby = 'c' + heldby.substring(2);
                    }

                    if ((/^(8[0-9]{6})$/.test(heldby)) === true) {
                        heldby = 'c' + heldby.substring(1);
                    }

                    if ((/^(l[0-9]{6})$/.test(heldby)) === true) {
                        heldby = 'b' + heldby.substring(1);
                    }

                    if ((/^([0-9]{5})$/.test(heldby)) === true) {
                        heldby = 'b0' + heldby;
                    }

                    if ((/^(0[0-9]{5})$/.test(heldby)) === true) {
                        heldby = 'b' + heldby;
                    }
                }

                var employee = employees.getFilteredRows([{column: 0, value: heldby}]);

                if (employee.length === 0) {                                                             /* The employee submitting the SCon doesn't exist in the employees table so create them */
                    employee[0] = employees.addRow([heldby, heldby, site, site + ': Unknown', site + ': Unknown']);
                    employeeTotalRows.push([{v: heldby}, {v: heldby}, {v: site}, {v: site + ': Unknown'}, {v: site + ': Unknown'}, {v: 0}, {v: 0}, {v: 0}]);
                }

                sconRows.push({c: [{v: heldby}, {v: employees.getValue(employee[0], 1)}, {v: employees.getValue(employee[0], 2)}, {v: employees.getValue(employee[0], 3)}, {v: employees.getValue(employee[0], 4)}, {v: scondate}, {v: site}, {v: parseInt(involved)}]});
            }
        });

        var scons = new google.visualization.DataTable({
            cols: [
                {id: 'heldby', label: 'Held By', type: 'string'},
                {id: 'name', label: 'Name', type: 'string'},
                {id: 'area', label: 'Area', type: 'string'},
                {id: 'team', label: 'Team', type: 'string'},
                {id: 'shiftrota', label: 'Shift Rota', type: 'string'},
                {id: 'dateheld', label: 'Date Held', type: 'date'},
                {id: 'siteheld', label: 'Site Held', type: 'string'},
                {id: 'peopleinvolved', label: 'People Involved', type: 'number'}
            ],
            rows: sconRows
        });

        var uniquePerMonth = google.visualization.data.group(scons,
                [{column: 5, modifier: getMonthName, type: 'string'}, 6],                /* Group by the dateheld and site to sum the unique SCons per month */
                [{
            column: 0,
            type: 'number',
            label: 'Total',
            aggregation: function (values) {
                var distinct = getDistinct(values);
                return distinct.length;
            }
        }]);

        var uniquePerWeek = google.visualization.data.group(scons,
                [{column: 5, modifier: getWeekName, type: 'string'}, 6],
                [{
            column: 0,
            type: 'number',
            label: 'Total',
            aggregation: function (values) {
                var distinct = getDistinct(values);
                return distinct.length;
            }
        }]);

        var involvedPerMonth = google.visualization.data.group(scons,
                [{column: 5, modifier: getMonthName, type: 'string'}, 6],
                [{
            column: 7,
            type: 'number',
            label: 'Total',
            aggregation: google.visualization.data.sum
        }]);

        var involvedPerWeek = google.visualization.data.group(scons,
                [{column: 5, modifier: getWeekName, type: 'string'}, 6],
                [{
            column: 7,
            type: 'number',
            label: 'Total',
            aggregation: google.visualization.data.sum
        }]);

        var quantityPerMonth = google.visualization.data.group(scons,
                [{column: 5, modifier: getMonthName, type: 'string'}, 6],
                [{
            column: 7,
            type: 'number',
            label: 'Quantity',
            aggregation: google.visualization.data.count
        }]);

        var quantityPerWeek = google.visualization.data.group(scons,
                [{column: 5, modifier: getWeekName, type: 'string'}, 6],
                [{
            column: 7,
            type: 'number',
            label: 'Quantity',
            aggregation: google.visualization.data.count
        }]);

        var colors, darlingtonUniquePerMonth, darlingtonUniquePerWeek, darlingtonInvolvedPerMonth, darlingtonInvolvedPerWeek, darlingtonQuantityPerMonth, darlingtonQuantityPerWeek, skinningroveUniquePerMonth, skinningroveUniquePerWeek, skinningroveInvolvedPerMonth, skinningroveInvolvedPerWeek, skinningroveQuantityPerMonth, skinningroveQuantityPerWeek, specialprofilesUniquePerMonth, specialprofilesUniquePerWeek, specialprofilesInvolvedPerMonth, specialprofilesInvolvedPerWeek, specialprofilesQuantityPerMonth, specialprofilesQuantityPerWeek, teessideUniquePerMonth, teessideUniquePerWeek, teessideInvolvedPerMonth, teessideInvolvedPerWeek, teessideQuantityPerMonth, teessideQuantityPerWeek, uniquePerMonthSites, uniquePerWeekSites, involvedPerWeekSites, involvedPerMonthSites, quantityPerWeekSites, quantityPerMonthSites;

        if (GetUrlKeyValue('specialprofiles', false)) {                             /* Join Skinningrove and Darlington data into one site named Special Profiles */
            colors = ['#5A245A', '#FFA100'];

            specialprofilesUniquePerMonth = new google.visualization.DataView(uniquePerMonth);
            specialprofilesUniquePerWeek = new google.visualization.DataView(uniquePerWeek);
            specialprofilesInvolvedPerMonth = new google.visualization.DataView(involvedPerMonth);
            specialprofilesInvolvedPerWeek = new google.visualization.DataView(involvedPerWeek);
            specialprofilesQuantityPerMonth = new google.visualization.DataView(quantityPerMonth);
            specialprofilesQuantityPerWeek = new google.visualization.DataView(quantityPerWeek);
            teessideUniquePerMonth = new google.visualization.DataView(uniquePerMonth);
            teessideUniquePerWeek = new google.visualization.DataView(uniquePerWeek);
            teessideInvolvedPerMonth = new google.visualization.DataView(involvedPerMonth);
            teessideInvolvedPerWeek = new google.visualization.DataView(involvedPerWeek);
            teessideQuantityPerMonth = new google.visualization.DataView(quantityPerMonth);
            teessideQuantityPerWeek = new google.visualization.DataView(quantityPerWeek);

            specialprofilesUniquePerMonth.setRows(uniquePerMonth.getFilteredRows([{column: 1, test: function (value) {
                if (value === 'Skinningrove' || value === 'Darlington') {
                    return 1;
                } else {
                    return 0;
                }
            }}]));
            specialprofilesUniquePerWeek.setRows(uniquePerWeek.getFilteredRows([{column: 1, test: function (value) {
                if (value === 'Skinningrove' || value === 'Darlington') {
                    return 1;
                } else {
                    return 0;
                }
            }}]));
            specialprofilesInvolvedPerMonth.setRows(involvedPerMonth.getFilteredRows([{column: 1, test: function (value) {
                if (value === 'Skinningrove' || value === 'Darlington') {
                    return 1;
                } else {
                    return 0;
                }
            }}]));
            specialprofilesInvolvedPerWeek.setRows(involvedPerWeek.getFilteredRows([{column: 1, test: function (value) {
                if (value === 'Skinningrove' || value === 'Darlington') {
                    return 1;
                } else {
                    return 0;
                }
            }}]));
            specialprofilesQuantityPerMonth.setRows(quantityPerMonth.getFilteredRows([{column: 1, test: function (value) {
                if (value === 'Skinningrove' || value === 'Darlington') {
                    return 1;
                } else {
                    return 0;
                }
            }}]));
            specialprofilesQuantityPerWeek.setRows(quantityPerWeek.getFilteredRows([{column: 1, test: function (value) {
                if (value === 'Skinningrove' || value === 'Darlington') {
                    return 1;
                } else {
                    return 0;
                }
            }}]));
            teessideUniquePerMonth.setRows(uniquePerMonth.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideUniquePerWeek.setRows(uniquePerWeek.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideInvolvedPerMonth.setRows(involvedPerMonth.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideInvolvedPerWeek.setRows(involvedPerWeek.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideQuantityPerMonth.setRows(quantityPerMonth.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideQuantityPerWeek.setRows(quantityPerWeek.getFilteredRows([{column: 1, value: 'Teesside'}]));
            specialprofilesUniquePerMonth = google.visualization.data.group(specialprofilesUniquePerMonth, [0],
                    [{
                column: 2,
                type: 'number',
                label: 'Total',
                aggregation: google.visualization.data.sum
            }]);
            specialprofilesUniquePerWeek = google.visualization.data.group(specialprofilesUniquePerWeek, [0],
                    [{
                column: 2,
                type: 'number',
                label: 'Total',
                aggregation: google.visualization.data.sum
            }]);
            specialprofilesInvolvedPerMonth = google.visualization.data.group(specialprofilesInvolvedPerMonth, [0],
                    [{
                column: 2,
                type: 'number',
                label: 'Total',
                aggregation: google.visualization.data.sum
            }]);
            specialprofilesInvolvedPerWeek = google.visualization.data.group(specialprofilesInvolvedPerWeek, [0],
                    [{
                column: 2,
                type: 'number',
                label: 'Total',
                aggregation: google.visualization.data.sum
            }]);
            specialprofilesQuantityPerMonth = google.visualization.data.group(specialprofilesQuantityPerMonth, [0],
                    [{
                column: 2,
                type: 'number',
                label: 'Total',
                aggregation: google.visualization.data.sum
            }]);
            specialprofilesQuantityPerWeek = google.visualization.data.group(specialprofilesQuantityPerWeek, [0],
                    [{
                column: 2,
                type: 'number',
                label: 'Total',
                aggregation: google.visualization.data.sum
            }]);

            uniquePerMonthSites = google.visualization.data.join(specialprofilesUniquePerMonth, teessideUniquePerMonth, 'left', [[0, 0]], [1], [2]);        /* Left join so that months or weeks with no SCons held are still shown in the charts */
            uniquePerMonthSites.setColumnLabel(1, 'Special Profiles');
            uniquePerMonthSites.setColumnLabel(2, 'Teesside');

            uniquePerWeekSites = google.visualization.data.join(specialprofilesUniquePerWeek, teessideUniquePerWeek, 'left', [[0, 0]], [1], [2]);
            uniquePerWeekSites.setColumnLabel(1, 'Special Profiles');
            uniquePerWeekSites.setColumnLabel(2, 'Teesside');

            involvedPerMonthSites = google.visualization.data.join(specialprofilesInvolvedPerMonth, teessideInvolvedPerMonth, 'left', [[0, 0]], [1], [2]);
            involvedPerMonthSites.setColumnLabel(1, 'Special Profiles');
            involvedPerMonthSites.setColumnLabel(2, 'Teesside');

            involvedPerWeekSites = google.visualization.data.join(specialprofilesInvolvedPerWeek, teessideInvolvedPerWeek, 'left', [[0, 0]], [1], [2]);
            involvedPerWeekSites.setColumnLabel(1, 'Special Profiles');
            involvedPerWeekSites.setColumnLabel(2, 'Teesside');

            quantityPerMonthSites = google.visualization.data.join(specialprofilesQuantityPerMonth, teessideQuantityPerMonth, 'left', [[0, 0]], [1], [2]);
            quantityPerMonthSites.setColumnLabel(1, 'Special Profiles');
            quantityPerMonthSites.setColumnLabel(2, 'Teesside');

            quantityPerWeekSites = google.visualization.data.join(specialprofilesQuantityPerWeek, teessideQuantityPerWeek, 'left', [[0, 0]], [1], [2]);
            quantityPerWeekSites.setColumnLabel(1, 'Special Profiles');
            quantityPerWeekSites.setColumnLabel(2, 'Teesside');
        } else {
            colors = ['#ED2939', '#5A245A', '#FFA100'];

            darlingtonUniquePerMonth = new google.visualization.DataView(uniquePerMonth);
            darlingtonUniquePerWeek = new google.visualization.DataView(uniquePerWeek);
            darlingtonInvolvedPerMonth = new google.visualization.DataView(involvedPerMonth);
            darlingtonInvolvedPerWeek = new google.visualization.DataView(involvedPerWeek);
            darlingtonQuantityPerMonth = new google.visualization.DataView(quantityPerMonth);
            darlingtonQuantityPerWeek = new google.visualization.DataView(quantityPerWeek);
            skinningroveUniquePerMonth = new google.visualization.DataView(uniquePerMonth);
            skinningroveUniquePerWeek = new google.visualization.DataView(uniquePerWeek);
            skinningroveInvolvedPerMonth = new google.visualization.DataView(involvedPerMonth);
            skinningroveInvolvedPerWeek = new google.visualization.DataView(involvedPerWeek);
            skinningroveQuantityPerMonth = new google.visualization.DataView(quantityPerMonth);
            skinningroveQuantityPerWeek = new google.visualization.DataView(quantityPerWeek);
            teessideUniquePerMonth = new google.visualization.DataView(uniquePerMonth);
            teessideUniquePerWeek = new google.visualization.DataView(uniquePerWeek);
            teessideInvolvedPerMonth = new google.visualization.DataView(involvedPerMonth);
            teessideInvolvedPerWeek = new google.visualization.DataView(involvedPerWeek);
            teessideQuantityPerMonth = new google.visualization.DataView(quantityPerMonth);
            teessideQuantityPerWeek = new google.visualization.DataView(quantityPerWeek);


            darlingtonUniquePerMonth.setRows(uniquePerMonth.getFilteredRows([{column: 1, value: 'Darlington'}]));
            darlingtonUniquePerWeek.setRows(uniquePerWeek.getFilteredRows([{column: 1, value: 'Darlington'}]));
            darlingtonInvolvedPerMonth.setRows(involvedPerMonth.getFilteredRows([{column: 1, value: 'Darlington'}]));
            darlingtonInvolvedPerWeek.setRows(involvedPerWeek.getFilteredRows([{column: 1, value: 'Darlington'}]));
            darlingtonQuantityPerMonth.setRows(quantityPerMonth.getFilteredRows([{column: 1, value: 'Darlington'}]));
            darlingtonQuantityPerWeek.setRows(quantityPerWeek.getFilteredRows([{column: 1, value: 'Darlington'}]));
            skinningroveUniquePerMonth.setRows(uniquePerMonth.getFilteredRows([{column: 1, value: 'Skinningrove'}]));
            skinningroveUniquePerWeek.setRows(uniquePerWeek.getFilteredRows([{column: 1, value: 'Skinningrove'}]));
            skinningroveInvolvedPerMonth.setRows(involvedPerMonth.getFilteredRows([{column: 1, value: 'Skinningrove'}]));
            skinningroveInvolvedPerWeek.setRows(involvedPerWeek.getFilteredRows([{column: 1, value: 'Skinningrove'}]));
            skinningroveQuantityPerMonth.setRows(quantityPerMonth.getFilteredRows([{column: 1, value: 'Skinningrove'}]));
            skinningroveQuantityPerWeek.setRows(quantityPerWeek.getFilteredRows([{column: 1, value: 'Skinningrove'}]));
            teessideUniquePerMonth.setRows(uniquePerMonth.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideUniquePerWeek.setRows(uniquePerWeek.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideInvolvedPerMonth.setRows(involvedPerMonth.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideInvolvedPerWeek.setRows(involvedPerWeek.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideQuantityPerMonth.setRows(quantityPerMonth.getFilteredRows([{column: 1, value: 'Teesside'}]));
            teessideQuantityPerWeek.setRows(quantityPerWeek.getFilteredRows([{column: 1, value: 'Teesside'}]));

            uniquePerMonthSites = google.visualization.data.join(darlingtonUniquePerMonth, skinningroveUniquePerMonth, 'right', [[0, 0]], [2], [2]);        /* Right join so that months or weeks with no SCons held are still shown in the charts */
            uniquePerMonthSites = google.visualization.data.join(uniquePerMonthSites, teessideUniquePerMonth, 'left', [[0, 0]], [1, 2], [2]);
            uniquePerMonthSites.setColumnLabel(1, 'Darlington');
            uniquePerMonthSites.setColumnLabel(2, 'Skinningrove');
            uniquePerMonthSites.setColumnLabel(3, 'Teesside');

            uniquePerWeekSites = google.visualization.data.join(darlingtonUniquePerWeek, skinningroveUniquePerWeek, 'right', [[0, 0]], [2], [2]);
            uniquePerWeekSites = google.visualization.data.join(uniquePerWeekSites, teessideUniquePerWeek, 'left', [[0, 0]], [1, 2], [2]);
            uniquePerWeekSites.setColumnLabel(1, 'Darlington');
            uniquePerWeekSites.setColumnLabel(2, 'Skinningrove');
            uniquePerWeekSites.setColumnLabel(3, 'Teesside');

            involvedPerMonthSites = google.visualization.data.join(darlingtonInvolvedPerMonth, skinningroveInvolvedPerMonth, 'right', [[0, 0]], [2], [2]);
            involvedPerMonthSites = google.visualization.data.join(involvedPerMonthSites, teessideInvolvedPerMonth, 'left', [[0, 0]], [1, 2], [2]);
            involvedPerMonthSites.setColumnLabel(1, 'Darlington');
            involvedPerMonthSites.setColumnLabel(2, 'Skinningrove');
            involvedPerMonthSites.setColumnLabel(3, 'Teesside');

            involvedPerWeekSites = google.visualization.data.join(darlingtonInvolvedPerWeek, skinningroveInvolvedPerWeek, 'right', [[0, 0]], [2], [2]);
            involvedPerWeekSites = google.visualization.data.join(involvedPerWeekSites, teessideInvolvedPerWeek, 'left', [[0, 0]], [1, 2], [2]);
            involvedPerWeekSites.setColumnLabel(1, 'Darlington');
            involvedPerWeekSites.setColumnLabel(2, 'Skinningrove');
            involvedPerWeekSites.setColumnLabel(3, 'Teesside');

            quantityPerMonthSites = google.visualization.data.join(darlingtonQuantityPerMonth, skinningroveQuantityPerMonth, 'right', [[0, 0]], [2], [2]);
            quantityPerMonthSites = google.visualization.data.join(quantityPerMonthSites, teessideQuantityPerMonth, 'left', [[0, 0]], [1, 2], [2]);
            quantityPerMonthSites.setColumnLabel(1, 'Darlington');
            quantityPerMonthSites.setColumnLabel(2, 'Skinningrove');
            quantityPerMonthSites.setColumnLabel(3, 'Teesside');

            quantityPerWeekSites = google.visualization.data.join(darlingtonQuantityPerWeek, skinningroveQuantityPerWeek, 'right', [[0, 0]], [2], [2]);
            quantityPerWeekSites = google.visualization.data.join(quantityPerWeekSites, teessideQuantityPerWeek, 'left', [[0, 0]], [1, 2], [2]);
            quantityPerWeekSites.setColumnLabel(1, 'Darlington');
            quantityPerWeekSites.setColumnLabel(2, 'Skinningrove');
            quantityPerWeekSites.setColumnLabel(3, 'Teesside');
        }

        var sconsUniqueByMonth = new google.visualization.ChartWrapper({
            chartType: 'ColumnChart',
            containerId: 'sconsuniquebymonth',
            dataTable: uniquePerMonthSites,
            options: {
                width: 530,
                height: 450,
                legend: {position: 'top'},
                hAxis: {title: 'Month'},
                vAxis: {title: 'Individual Submissions'},
                colors: colors/*,
                animation: {
                    duration: 1000,
                    startup: true
                }*/
            }
        });

        google.visualization.events.addListener(sconsUniqueByMonth, 'ready', function () {
            $('#sconsuniquebymonth + div.export').html('<a href="' + sconsUniqueByMonth.getChart().getImageURI() + '" target="_blank"><img src="/_layouts/images/sendOtherLoc.gif" alt="">Export Chart</a>');
        });

        var sconsUniqueByWeek = new google.visualization.ChartWrapper({
            chartType: 'LineChart',
            containerId: 'sconsuniquebyweek',
            dataTable: uniquePerWeekSites,
            options: {
                width: 530,
                height: 450,
                legend: {position: 'top'},
                hAxis: {title: 'Week'},
                vAxis: {title: 'Individual Submissions'},
                colors: colors/*,
                animation: {
                    duration: 1000,
                    startup: true
                }*/
            }
        });

        google.visualization.events.addListener(sconsUniqueByWeek, 'ready', function () {
            $('#sconsuniquebyweek + div.export').html('<a href="' + sconsUniqueByWeek.getChart().getImageURI() + '" target="_blank"><img src="/_layouts/images/sendOtherLoc.gif" alt="">Export Chart</a>');
        });

        var sconsInvolvedByMonth = new google.visualization.ChartWrapper({
            chartType: 'ColumnChart',
            containerId: 'sconsinvolvedbymonth',
            dataTable: involvedPerMonthSites,
            options: {
                width: 530,
                height: 450,
                legend: {position: 'top'},
                hAxis: {title: 'Month'},
                vAxis: {title: 'People Involved'},
                colors: colors
            }
        });

        google.visualization.events.addListener(sconsInvolvedByMonth, 'ready', function () {
            $('#sconsinvolvedbymonth + div.export').html('<a href="' + sconsInvolvedByMonth.getChart().getImageURI() + '" target="_blank"><img src="/_layouts/images/sendOtherLoc.gif" alt="">Export Chart</a>');
        });

        var sconsInvolvedByWeek = new google.visualization.ChartWrapper({
            chartType: 'LineChart',
            containerId: 'sconsinvolvedbyweek',
            dataTable: involvedPerWeekSites,
            options: {
                width: 530,
                height: 450,
                legend: {position: 'top'},
                hAxis: {title: 'Week'},
                vAxis: {title: 'People Involved'},
                colors: colors
            }
        });

        google.visualization.events.addListener(sconsInvolvedByWeek, 'ready', function () {
            $('#sconsinvolvedbyweek + div.export').html('<a href="' + sconsInvolvedByWeek.getChart().getImageURI() + '" target="_blank"><img src="/_layouts/images/sendOtherLoc.gif" alt="">Export Chart</a>');
        });

        var sconsQuantityByMonth = new google.visualization.ChartWrapper({
            chartType: 'ColumnChart',
            containerId: 'sconsquantitybymonth',
            dataTable: quantityPerMonthSites,
            options: {
                width: 530,
                height: 450,
                legend: {position: 'top'},
                hAxis: {title: 'Month'},
                vAxis: {title: 'Total Submissions'},
                colors: colors
            }
        });

        google.visualization.events.addListener(sconsQuantityByMonth, 'ready', function () {
            $('#sconsquantitybymonth + div.export').html('<a href="' + sconsQuantityByMonth.getChart().getImageURI() + '" target="_blank"><img src="/_layouts/images/sendOtherLoc.gif" alt="">Export Chart</a>');
        });

        var sconsQuantityByWeek = new google.visualization.ChartWrapper({
            chartType: 'LineChart',
            containerId: 'sconsquantitybyweek',
            dataTable: quantityPerWeekSites,
            options: {
                width: 530,
                height: 450,
                legend: {position: 'top'},
                hAxis: {title: 'Week'},
                vAxis: {title: 'Total Submissions'},
                colors: colors
            }
        });

        google.visualization.events.addListener(sconsQuantityByWeek, 'ready', function () {
            $('#sconsquantitybyweek + div.export').html('<a href="' + sconsQuantityByWeek.getChart().getImageURI() + '" target="_blank"><img src="/_layouts/images/sendOtherLoc.gif" alt="">Export Chart</a>');
        });

        var today = new Date();
        var sconsByDate = new google.visualization.Dashboard($('#sconsbydate'));

        var sconsByDateFilter = new google.visualization.ControlWrapper({
            controlType: 'DateRangeFilter',
            containerId: 'sconsbydatefilter',
            options: {
                filterColumnLabel: 'Date Held',
                ui: {
                    labelStacking: 'vertical',
                    label: 'Date Held',
                    labelSeparator: ':',
                    format: {
                        pattern: 'dd/MM/yyyy'
                    }
                }
            },
            state: {
                lowValue: new Date(today.getFullYear(), today.getMonth(), 1)
            }
        });

        var sconsByDateTable = new google.visualization.ChartWrapper({
            chartType: 'Table',
            containerId: 'sconsbydatetable',
            options: {                                                      /* minimize the footprint of the table in HTML */
                page: 'enable',
                pageSize: 1
            },
            view: {
                columns: [0]
            }
        });

        google.visualization.events.addListener(sconsByDateTable, 'ready', function () {                        /* Take the data from sconsByDateTable (which has just been filtered by date) and provides this in a grouped format to populate the sconsByPerson chart */
            setTimeout(function () {                                        /* Add a short pause before re-drawing the charts, as control movement can be inaccurate */
                try {
                    var sconsData = sconsByDateTable.getDataTable(),
                        darlingtonScons = new google.visualization.DataView(sconsData),
                        skinningroveScons = new google.visualization.DataView(sconsData),
                        teessideScons = new google.visualization.DataView(sconsData);

                    darlingtonScons.setRows(sconsData.getFilteredRows([{column: 6, value: 'Darlington'}]));                    /* Filter by siteheld */
                    skinningroveScons.setRows(sconsData.getFilteredRows([{column: 6, value: 'Skinningrove'}]));
                    teessideScons.setRows(sconsData.getFilteredRows([{column: 6, value: 'Teesside'}]));

                    darlingtonScons = google.visualization.data.group(
                        darlingtonScons,
                        [0, 1, 2, 3, 4],                                                                                        /* Group by heldby, name, area, team, shiftrota to count the scons per person in the selected date range and site */
                        [{
                            column: 0,
                            type: 'number',
                            label: 'Total Darlington',
                            aggregation: google.visualization.data.count
                        }]
                    );

                    skinningroveScons = google.visualization.data.group(
                        skinningroveScons,
                        [0, 1, 2, 3, 4],
                        [{
                            column: 0,
                            type: 'number',
                            label: 'Total Skinningrove',
                            aggregation: google.visualization.data.count
                        }]
                    );

                    teessideScons = google.visualization.data.group(
                        teessideScons,
                        [0, 1, 2, 3, 4],
                        [{
                            column: 0,
                            type: 'number',
                            label: 'Total Teesside',
                            aggregation: google.visualization.data.count
                        }]
                    );

                    sconsData = google.visualization.data.join(darlingtonScons, skinningroveScons, 'full', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]], [5], [5]);             /* Full join to include all rows from both tables */
                    sconsData = google.visualization.data.join(sconsData, teessideScons, 'full', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]], [5, 6], [5]);

                    sconsData.addRows(employeeTotalRows);                          /* Append all employees so we include people who've done zero scons */

                    sconsData = google.visualization.data.group(
                        sconsData,
                        [0, 1, 2, 3, 4],                                        /* Group by heldby, name, area, team, shiftrota to sum the person's total number of scons per site */
                        [{
                            column: 5,
                            type: 'number',
                            label: 'Darlington',
                            aggregation: google.visualization.data.sum
                        }, {
                            column: 6,
                            type: 'number',
                            label: 'Skinningrove',
                            aggregation: google.visualization.data.sum
                        }, {
                            column: 7,
                            type: 'number',
                            label: 'Teesside',
                            aggregation: google.visualization.data.sum
                        }]
                    );

                    sconsData.sort(1);                                  /* Sort by person's name */

                    var sconsTotals = new google.visualization.DataView(sconsData);

                    sconsTotals.setColumns([0, 1, 2, 3, 4, 5, 6, 7, {calc: function (dataTable, rowNum) {                               /* Add a calculated column with the persons total across all three sites */
                        return dataTable.getValue(rowNum, 5) + dataTable.getValue(rowNum, 6) + dataTable.getValue(rowNum, 7);
                    }, type: 'number', label: 'Total'}]);

                    sconsByPerson.draw(sconsTotals);
                } catch (ignore) {                  /* Ignore any errors which may occur from re-drawing the charts whilst data is still being filtered using the controls */
                    return;
                }
            }, 1500);
        });

        sconsByDate.bind(sconsByDateFilter, sconsByDateTable);

        var sconsByPerson = new google.visualization.Dashboard($('#sconsbyperson'));

        var sconsByPersonAreaFilter = new google.visualization.ControlWrapper({
            controlType: 'CategoryFilter',
            containerId: 'sconsbypersonareafilter',
            options: {
                filterColumnLabel: 'Area',
                ui: {
                    labelStacking: 'vertical',
                    selectedValuesLayout: 'belowStacked',
                    allowNone: false,
                    label: 'Area',
                    labelSeparator: ':',
                    allowTyping: false,
                    allowMultiple: false
                }
            },
            state: {
                selectedValues: [GetUrlKeyValue('site', false)]                     /* Select the site if given on the query string */
            }
        });

        var sconsByPersonTeamFilter = new google.visualization.ControlWrapper({
            controlType: 'CategoryFilter',
            containerId: 'sconsbypersonteamfilter',
            options: {
                filterColumnLabel: 'Team',
                ui: {
                    labelStacking: 'vertical',
                    selectedValuesLayout: 'belowStacked',
                    label: 'Team',
                    labelSeparator: ':',
                    allowTyping: false,
                    allowMultiple: true
                }
            }
        });

        var sconsByPersonRotaFilter = new google.visualization.ControlWrapper({
            controlType: 'CategoryFilter',
            containerId: 'sconsbypersonrotafilter',
            options: {
                filterColumnLabel: 'Shift Rota',
                ui: {
                    labelStacking: 'vertical',
                    selectedValuesLayout: 'belowStacked',
                    label: 'Shift Rota',
                    labelSeparator: ':',
                    allowTyping: false,
                    allowMultiple: true
                }
            }
        });

        var sconsByPersonQuantityFilter = new google.visualization.ControlWrapper({
            controlType: 'NumberRangeFilter',
            containerId: 'sconsbypersonquantityfilter',
            options: {
                filterColumnLabel: 'Total',
                ui: {
                    labelStacking: 'vertical',
                    label: 'Individual Total',
                    labelSeparator: ':',
                    format: {pattern: '0'}
                }
            },
            state: {
                lowValue: GetUrlKeyValue('totalmin', false) || 0,
                highValue: GetUrlKeyValue('totalmax', false) || 99999
            }
        });

        var sconsByPersonChart = new google.visualization.ChartWrapper({
            chartType: 'BarChart',
            containerId: 'sconsbypersonchart',
            view: {columns: [1, 5, 6, 7]},
            options: {
                width: 720,
                height: '100%',                                         /* Percentage value for the dynamic sizing */
                isStacked: true,
                legend: {position: 'top'},
                fontSize: 14,
                axisTitlesPosition: 'in',
                hAxis: {title: 'Safety Conversations', format: '0', textPosition: 'in'},
                colors: ['#ED2939', '#5A245A', '#FFA100'],
                chartArea: {top: 45, right: 0, bottom: 45, height: '100%', width: '60%'},
                animation: {
                    duration: 1000/*,
                    startup: true     Seems to be a bug when using this with a Dashboard, possibly because the data isn't set until it's draw. Doesn't really matter as we re-draw the chart when it's ready to suit the number of rows displayed */
                }
            }
        });

        google.visualization.events.addListener(sconsByPerson, 'ready', function () {                           /* Redraw the dashboard to fit the number of rows displayed after the user has changed one of the controls. From http://stackoverflow.com/questions/5990755/google-chart-altering-height-of-chart-dynamically-based-on-total-rows */
            setTimeout(function () {
                try {
                    var numRows = sconsByPersonChart.getDataTable().getNumberOfRows();
                    var expectedHeight = (numRows * 40) + 50;
                    if (parseInt(sconsByPersonChart.getOption('height'), 10) !== expectedHeight) {
                        $('#sconsbypersonchart').height(expectedHeight + 'px');
                        sconsByPersonChart.setOption('height', expectedHeight);
                        sconsByPersonChart.draw();
                    }

                    $('#sconsbypersonchart + div.export').html('<a href="' + sconsByPersonChart.getChart().getImageURI() + '" target="_blank"><img src="/_layouts/images/sendOtherLoc.gif" alt="">Export Chart</a>');
                } catch (ignore) {
                    return;
                }
            }, 1000);
        });

        sconsByPerson.bind(sconsByPersonAreaFilter, sconsByPersonTeamFilter);                /* Bind the controls to each other rather than all at once to the chart, so that each control drives the options avaliable in the next control */
        sconsByPerson.bind(sconsByPersonTeamFilter, sconsByPersonRotaFilter);
        sconsByPerson.bind(sconsByPersonRotaFilter, sconsByPersonQuantityFilter);
        sconsByPerson.bind(sconsByPersonQuantityFilter, sconsByPersonChart);

        sconsUniqueByMonth.draw();
        sconsUniqueByWeek.draw();
        sconsInvolvedByMonth.draw();
        sconsInvolvedByWeek.draw();
        sconsQuantityByMonth.draw();
        sconsQuantityByWeek.draw();
        sconsByDate.draw(scons);
    }

    function addViewMenuItems() {
        /*  Adds custom menu items to the List view menus
        */
        if (window.location.pathname.indexOf('Lists/Safety%20Conversations') >= 0) {
            $('td.ms-viewselector span menu').append('<ie:menuitem type="option" iconsrc="/_layouts/images/itobject.gif" onmenuclick="window.location = \'/sites/longcorp/normills/Health%20%20Safety/Safety%20Conversation%20Dashboard.aspx\';" text="Dashboard" menugroupid="500" enabled="true" checked="false" onmenuclick_original="window.location = \'/sites/longcorp/normills/Health%20%20Safety/Safety%20Conversation%20Dashboard.aspx\';" text_original="All"></ie:menuitem>');
        }

        return;
    }

    function checkInternetConnection() {
        /*  Checks for an active Internet connection to ensure the firewall authentication has taken place
            If no Internet access is alert the user and redirect to provoke the firewall authentication
        */
        /*
            Try using checkconnectivity.gstatic.com/generate_204 or http://www.gstatic.com/generate_204 instead of an image
        */
        var online = new Image();

        /*online.onload  = function () {
            console.log('Active Internet firewall connection');
            return;
        };*/

        online.onerror = function () {
            alert('An active Internet Gateway session is required to use this page.\n\nYou will be now redirected to www.google.com to trigger the Internet logon process, after which you may return to this page.');
            window.location.href = 'http://www.google.com/';
            return;
        };

        online.src = 'http://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png?d=' + escape(new Date().getTime());         /* Query string param to help prevent iamge being cached */

        return;
    }

    function displayWorkPackStatus() {
        /*  Applys a colour code to the Work Pack Register "Status" field
        */

        $('table[summary="Work Pack Register"] > tbody > tr').not('.ms-viewheadertr').each(function (ignore, tr) {
            var row = $(tr),
                warningDateValue = row.find('td:nth-of-type(8)').text(),
                expiryDateValue = row.find('td:nth-of-type(9)').text(),
                status = row.find('td:nth-of-type(10)'),
                today = new Date(),
                warningDate = new Date(formatDate(warningDateValue)),
                expiryDate = new Date(formatDate(expiryDateValue));

            status.addClass('workpackregister');

            if (expiryDate <= today) {
                status.addClass('expired');
                status.text('Red');
            } else if (warningDate <= today) {
                status.addClass('warning');
                status.text('Amber');
            } else {
                status.addClass('valid');
                status.text('Green');
            }
        });

        if (window.location.pathname.indexOf('Work%20Pack%20Register/DispForm') >= 0) {
            var warningDateValue = $('table.ms-formtable tr:nth-of-type(8) td#SPFieldCalculated').text().trim(),
                expiryDateValue = $('table.ms-formtable tr:nth-of-type(9) td#SPFieldCalculated').text().trim(),
                status = $('table.ms-formtable tr:nth-of-type(10) td#SPFieldCalculated'),
                today = new Date(),
                warningDate = new Date(formatDate(warningDateValue)),
                expiryDate = new Date(formatDate(expiryDateValue));

            status.removeClass('ms-formbody').addClass('workpackregister');

            if (expiryDate <= today) {
                status.addClass('expired');
                status.text('Red');
            } else if (warningDate <= today) {
                status.addClass('warning');
                status.text('Amber');
            } else {
                status.addClass('valid');
                status.text('Green');
            }
        }

        return;
    }

    function previewAttachments() {
        /*  Adds a preview for any attached images or documents when viewing an item
        */
        $('#idAttachmentsTable a').each(function (ignore, link) {
            var href = $(link).prop('href');

            if (new RegExp('\.jpg|\.jpeg|\.png|\.gif|\.bmp|\.tif|\.tiff', 'i').test(href)) {                       /* Image attachements, ignoring case */
                $('<br>').appendTo(link);

                $('<img>', {
                    src: href,
                    'class': 'attachmentpreview'                                                                        /* class requires quotes as IE6 will raise an error without them */
                }).appendTo(link);
            } else if (new RegExp('\.pdf', 'i').test(href)) {                                                       /* PDF attachments */
                $('<br>').appendTo(link);

                $('<iframe>', {
                    src: href + '?#view=fit&scrollbars=0&toolbar=0&navpanes=0&statusbar=0',
                    'class': 'attachmentpreview'
                }).insertAfter(link);
            } else if (new RegExp('\.wmv', 'i').test(href)) {                                    /* WMV attachements, ignoring case */
                $('<br>').appendTo(link);
                $('<object classid="CLSID:22D6F312-B0F6-11D0-94AB-0080C74C7E95" width="600" height="600" "standby="Loading Windows Media Player components..." type="application/x-oleobject"><param name="FileName" value="' + href + '"><param name="ShowControls" value="true"><param name="ShowStatusBar" value="true"><param name="ShowDisplay" value="false"><param name="autostart" value="false"><embed type="application/x-mplayer2" src="' + href + '" width="600" height="600" ShowControls="1" ShowStatusBar="1" ShowDisplay="0" autostart="0"></embedD></object>').insertAfter(link);
            } else if ((window.navigator.userAgent.indexOf('MSIE') >= 0 || window.navigator.userAgent.indexOf('Trident') >= 0) && new RegExp('\.xps|\.doc|\.docx|\.xls|\.xlsx|\.ppt|\.pptx', 'i').test(href)) {         /* Internet Explorer and document attachments */
                $('<br>').appendTo(link);

                $('<iframe>', {
                    src: href,
                    'class': 'attachmentpreview'
                }).insertAfter(link);
            }

            return;
        });

        return;
    }

    //function setFormDefaults() {
    //    /*
    //    If form element exists and is empty
    //    if string without domain starts with b0 or c0 then use that value

    //    */

        //ctl00_m_g_b6f506f0_34dd_4ae9_960a_24056c2471f6_ctl00_ctl04_ctl00_ctl00_ctl00_ctl04_ctl00_ctl00_TextField
    //    console.log($().SPServices.SPGetCurrentUser({
    //      fieldName: "Title",
    //      debug: false
    //    }));

    //    return;
    //}

    return {
        addViewMenuItems: addViewMenuItems,
        checkInternetConnection: checkInternetConnection,
        displayWorkPackStatus: displayWorkPackStatus,
        displayLubricationDashboard: displayLubricationDashboard,
        displaySconDashboard: displaySconDashboard,
        //setFormDefaults: setFormDefaults,
        previewAttachments: previewAttachments
    };
}());


$(document).ready(function () {
    'use strict';
    main.addViewMenuItems();
    main.previewAttachments();
    main.displayWorkPackStatus();
    //main.setFormDefaults();

    if (window.location.pathname.indexOf('Health%20%20Safety/Safety%20Conversation%20Dashboard') >= 0) {
        main.checkInternetConnection();
        google.setOnLoadCallback(main.displaySconDashboard);
    }

    if (window.location.pathname.indexOf('Site%20Assets/Lubrication%20Dashboard') >= 0) {
        main.checkInternetConnection();
        google.setOnLoadCallback(main.displayLubricationDashboard);
    }

    return;
});
