/* jshint node: true */
/* jshint esversion: 6 */
'use sctrict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require('vscode');
var http = require('http');

class FingeraStatusBarItem {
    constructor() {
        this._statusBarDeltaItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
        this._statusBarArrivalItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999);
        // this._statusBarItem.tooltip = 'Click to insert into selection';

        this._statusBarDeltaItem.show();
        this._interval = setInterval(() => this.update(), 30 * 1000);
        this._delta_error_flag = false;
        this._arrival_error_flag = false;
        this.update();
    }

    dispose() {
        this._statusBarItem.dispose();
        clearInterval(this._interval);
    }

    update() {
        let config = vscode.workspace.getConfiguration('fingera');

        this._updateDelta(config.host, config.user_number);

        if (config.show_arrival) {
            this._updateArrival(config.host, config.user_number);
            this._statusBarArrivalItem.show();
        } else {
            this._statusBarArrivalItem.hide();
        }

    }

    _deltaError() {
        var msg = "Fingera Status delta information didn't updated well. :(";
        this._statusBarDeltaItem.text = "$(bug)";
        this._statusBarDeltaItem.tooltip = msg;
        if (!this._delta_error_flag) {
            vscode.window.showErrorMessage(msg);
            this._delta_error_flag = true;
        }

    }
    _arrivalError() {
        var msg = "Fingera Status arrival information didn't updated well. :(";
        this._statusBarArrivalItem.text = "$(bug)";
        this._statusBarArrivalItem.tooltip = msg;
        if (!this._delta_error_flag) {
            vscode.window.showErrorMessage(msg);
            this._arrival_error_flag = true;
        }

    }
    _updateDelta(host, user_number) {
        var request, options;

        options = {
            host: host,
            path: `/users_summary/toggle_user_status/${user_number}?show_worktime=1`
        };

        http.get(options, (response) => {
            if (!((response.statusCode >= 200) && (response.statusCode < 400))) {
                this._deltaError();
                return;
            }

            let body = "";
            response.on('data', (chunk) => {
                body += chunk;
            });

            response.on('end', () => {
                let data_value = /(.*>)(.+)(<\/a>\"\)\;)/im.exec(body)[2];
                let delta_value = data_value.split("/")[1].replace(/^\s+|\s+$/g, '');
                let summary_value = data_value.split("/")[0].replace(/^\s+|\s+$/g, '');
                // if (delta_value.indexOf("+") >= 0) {
                //     // Positive (GOOD)
                // } else {
                //     // Negative (MEH)
                // }
                this._statusBarDeltaItem.text = delta_value;
                this._statusBarDeltaItem.tooltip = summary_value;
                this._delta_error_flag = false;
            });
        }).on('error', (e) => {
            this._deltaError();
        });
    }
    _updateArrival(host, user_number) {
        // https://regex101.com/r/kM1oL0/3
        let arrival_regexp_string = `<div id="user_status_info_${user_number}([\\s\\S]+?)v práci od (\\d+:\\d+)`;
        let arrival_regexp = new RegExp(arrival_regexp_string, 'igm');

        let options = {
            host: host,
            path: `http://${host}/users_summary`
        };

        http.get(options, (response) => {
            if (!((response.statusCode >= 200) && (response.statusCode < 400))) {
                this._arrivalError();
                return;
            }

            let body = "";
            response.on('data', (chunk) => {
                body += chunk;
            });

            response.on('end', () => {
                var arrival_symbol,
                    arrival_text,
                    arrival_tooltip_text,
                    arrival_delta_minutes;

                let match = arrival_regexp.exec(body);
                let arrival_value = match === null ? null : match[2]
                if ((arrival_value === null) || (arrival_value.length < 1)) {
                    this._statusBarArrivalItem.text = `$(sign-out)`;
                    this._statusBarArrivalItem.tooltip = "";

                    return;
                }

                let h = parseInt(arrival_value.split(":")[0], 10);
                let m = parseInt(arrival_value.split(":")[1], 10);

                let arrival_date = new Date();
                arrival_date.setHours(h);
                arrival_date.setMinutes(m);
                arrival_date.setSeconds(0);
                let arrival_period_minutes = vscode.workspace.getConfiguration('fingera').arrival_timer;


                if (arrival_period_minutes > 0) {
                    let now = new Date();
                    let arrival_delta = now - arrival_date;
                    let arrival_delta_seconds = arrival_delta / 1000;
                    arrival_delta_minutes = arrival_delta_seconds / 60;
                    let arrival_period_seconds = arrival_period_minutes * 60;

                    if (arrival_delta_seconds < (arrival_period_seconds * 0.25)) {
                        arrival_symbol = "▁";
                    } else if (arrival_delta_seconds < (arrival_period_seconds * 0.5)) {
                        arrival_symbol = "▃";
                    } else if (arrival_delta_seconds < (arrival_period_seconds * 0.75)) {
                        arrival_symbol = "▅";
                    } else if (arrival_delta_seconds < arrival_period_seconds) {
                        arrival_symbol = "▇";
                    } else {
                        arrival_symbol = "✓";
                    }
                } else {
                    arrival_symbol = "";
                }

                if (arrival_delta_minutes > arrival_period_minutes) {
                    arrival_tooltip_text = "" + arrival_value;
                    arrival_text = "+" + (Math.round(arrival_delta_minutes) - 60);
                } else {
                    arrival_tooltip_text = (Math.round(arrival_delta_minutes)) + " minutes";
                    arrival_text = "" + arrival_value;
                }

                this._statusBarArrivalItem.text = `${arrival_symbol} ${arrival_text}`;
                this._statusBarArrivalItem.tooltip = `${arrival_tooltip_text}`;
                this._arrival_error_flag = false;
            });

        }).on('error', (e) => {
            this._arrivalError();
        });

    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Fingera UP');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json

    context.subscriptions.push(new FingeraStatusBarItem());

}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;