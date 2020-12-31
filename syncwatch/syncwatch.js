/*********************************************************
 * SCRIPT : syncwatch.js                                 *
 *          Javascript for syncwatch Cockpit web-gui     *
 *                                                       *
 *          I. Helwegen 2020                             *
 *********************************************************/

////////////////////
// Common classes //
////////////////////

class syncJobs {
    constructor(el) {
        this.el = el;
        this.name = "jobs";
        this.pane = new tabPane(this, el, this.name);
        this.dropdownContent = [
            {name : "Enable", disable: "enabled", disableValue: true, callback: this.enable},
            {name : "Disable", disable: "enabled", disableValue: false, callback: this.disable},
            {name : "Delete", disable: null, disableValue: null, callback: this.delete}
        ];
        this.jobs = [];
        this.hasXnas = false;
    }

    displayContent(el) {
        this.pane.dispose();
        this.pane.build();
        this.pane.getTitle().innerHTML = this.name.charAt(0).toUpperCase() + this.name.slice(1);
        this.pane.addButton("add", "Add", this.addJob, true, false, false);
        //this.pane.addButton("restart", "Restart", this.displayList, false, false, false); // auto done, rest can be done in services
        this.pane.getTable().setOnClick(this.tableClickCallback);
        this.pane.getTable().setDropDown(this.dropdownContent);
        var jobsCb = function(has) {
            this.hasXnas = has;
            this.getJobs();
        }
        this.xnasInstalled(jobsCb);
    }

    getJobs() {
        var cb = function(data) {
            var tData = JSON.parse(data);
            var lData = [];
            this.jobs = [];
            tData.forEach(datum => {
                this.jobs.push(datum.job);
                if (this.isSafe(datum.source, datum.destination)) {
                    datum.source = "Xshare:" + this.folder2safe(datum.source);
                    datum.destination = "Xshare:" + this.folder2safe(datum.destination);
                }
                lData.push(datum);
            });
            this.pane.getTable().setData(lData);
        }
        runCmd.call(this, cb);
    }

    addJob() {
        var jData = {};
        jData.enabled = true;
        jData.source = "";
        jData.destination = "";
        jData.delay = 10;
        jData.resettimer = true;
        jData.initsync = false;
        jData.reversesync = false;
        jData.retry = false;
        jData.delete = true;
        jData.exclude = "";
        jData.include = "";
        jData.compress = true;
        jData.update = true;
        jData.options = "";
        this.pane.disposeSpinner();
        this.buildEditDialog(null, jData);

    }

    tableClickCallback(data) {
        var cbEdit = function(jData) {
            var aData = JSON.parse(jData);
            if (!('enabled' in aData)) {
                aData['enabled'] = true;
            }
            this.pane.getTable().loadingDone();
            this.pane.disposeSpinner();
            this.buildEditDialog(data.job, aData);
        }
        this.pane.showSpinner();
        runCmd.call(this, cbEdit, ["shw", data.job]);
    }

    buildEditDialog(name, aData) {
        var dialog = new editDialog(this);
        var sourceValid = false;
        var destinationValid = false;
        var safesyncChangedCallback = function(param, safesync) {
            if (safesync) {
                var optsCb = function(labels) {
                    var opts = [];
                    labels.forEach(label => {
                        opts.push(this.safe2folder(label));
                    })
                    // (Re)load safesync dialog
                    var dlgData = [{
                            param: "enabled",
                            text: "Enabled",
                            value: aData.enabled,
                            type: "boolean",
                            disabled: false,
                            readonly: true,
                            comment: "Is this sync job currently enabled?"
                        }, {
                            param: "source",
                            text: "Source Xshare",
                            value: aData.source,
                            type: "disk",
                            opts: opts,
                            optslabel: labels,
                            optssingle: true,
                            disabled: false,
                            readonly: false,
                            labelonly: true,
                            onchange: sourceChangedCallback,
                            comment: "Source Xhare to sync (safe reference)"
                        }, {
                            param: "destination",
                            text: "Destination Xshare",
                            value: aData.destination,
                            type: "disk",
                            opts: opts,
                            optslabel: labels,
                            optssingle: true,
                            disabled: false,
                            readonly: false,
                            labelonly: true,
                            onchange: destinationChangedCallback,
                            comment: "Destination Xshare to sync (safe reference)"
                        }, {
                            param: "delay",
                            text: "Delay",
                            value: aData.delay,
                            type: "number",
                            min: 0,
                            max: 500,
                            step: 1,
                            disabled: false,
                            readonly: false,
                            comment: "Defines the delay between writing something to the source folder and starting to sync in seconds. This is to prevent syncing while still writing data. (default = 10 seconds)"
                        }, {
                            param: "resettimer",
                            text: "Reset timer",
                            value: aData.resettimer,
                            type: "boolean",
                            disabled: false,
                            readonly: false,
                            comment: "Defines whether to reset the timer (start the delay again) when writing data during the delay time. Default is true."
                        }, {
                            param: "initsync",
                            text: "Init sync",
                            value: aData.initsync,
                            type: "boolean",
                            disabled: false,
                            readonly: false,
                            comment: "Defines whether to sync on the program start. Default is false."
                        }, {
                            param: "reversesync",
                            text: "Reverse sync",
                            value: aData.reversesync,
                            type: "boolean",
                            disabled: false,
                            readonly: false,
                            comment: "Defines whether to sync to source when a file or folder on the target changes. Default is false."
                        }, {
                            param: "retry",
                            text: "Retry",
                            value: aData.retry,
                            type: "boolean",
                            disabled: false,
                            readonly: false,
                            comment: "Defines whether to keep retrying setting up a connection, e.g. when source or destination is not mounted (yet). Retry is done silent with a 10 second delay. Default is false."
                        }, {
                            param: "delete",
                            text: "Delete",
                            value: aData.delete,
                            type: "boolean",
                            disabled: false,
                            readonly: false,
                            comment: "Defines whether to delete file on the destination (see rsync delete). Default is true."
                        }, {
                            param: "exclude",
                            text: "Exclude",
                            value: cs2arr(aData.exclude),
                            type: "multi",
                            disabled: false,
                            readonly: false,
                            comment: "Defines patterns to be excluded from syncing (see rsync exclude). Default is empty."
                        }, {
                            param: "include",
                            text: "Include",
                            value: cs2arr(aData.include),
                            type: "multi",
                            disabled: false,
                            readonly: false,
                            comment: "Defines patterns to be included in syncing (see rsync include). Default is empty."
                        }, {
                            param: "compress",
                            text: "Compress",
                            value: aData.compress,
                            type: "boolean",
                            disabled: false,
                            readonly: false,
                            comment: "Defines whether to compress files to be synced (see rsync compress). Default is true."
                        }, {
                            param: "update",
                            text: "Update",
                            value: aData.update,
                            type: "boolean",
                            disabled: false,
                            readonly: false,
                            comment: "Defines whether to update files to be synced (see rsync update). Default is true."
                        }, {
                            param: "options",
                            text: "Options",
                            value: cs2arr(aData.options),
                            type: "multi",
                            disabled: false,
                            readonly: false,
                            comment: "Defines options added to rsync (see rsync manual). Contents is not checked. Default is empty."
                        }
                    ];
                    if (this.hasXnas) {
                        dlgData.splice(1, 0, {
                            param: "safesync",
                            text: "Safe reference",
                            value: safesync,
                            type: "boolean",
                            disabled: false,
                            readonly: false,
                            onchange: safesyncChangedCallback,
                            comment: "With safe reference an Xnas share is used, instead of any folder"
                        });
                    }
                    var title = "";
                    if (name == null) {
                        let iName = "";
                        iName = generateUniqueName(this.jobs, aData.source, aData.destination);
                        dlgData.splice(0, 0, {
                            param: "name",
                            text: "Job name",
                            value: iName,
                            type: "text",
                            disabled: false,
                            readonly: false,
                            comment: "Enter a unique name for the job here"
                        });
                        title = "Add sync job";
                    } else {
                        title = "Edit sync job: " + name;
                    }
                    setTimeout(function () {
                        dialog.build(title, dlgData, cbOk);
                        dialog.setEditButtonDisabled(!sourceValid || !destinationValid);
                    }, 300);
                }
                this.getXshares(optsCb);
            } else {
                // (Re)load standard dialog
                var dlgData = [{
                        param: "enabled",
                        text: "Enabled",
                        value: aData.enabled,
                        type: "boolean",
                        disabled: false,
                        readonly: true,
                        comment: "Is this sync job currently enabled?"
                    }, {
                        param: "source",
                        text: "Source",
                        value: aData.source,
                        type: "file",
                        disabled: false,
                        readonly: false,
                        alttext: "Select source folder",
                        filedir: true,
                        filesave: false,
                        fileaddnew: false,
                        filetextedit: false,
                        filebase: "/",
                        filerelative: false,
                        onchange: sourceChangedCallback,
                        comment: "Source folder to sync"
                    }, {
                        param: "destination",
                        text: "Destination",
                        value: aData.destination,
                        type: "file",
                        disabled: false,
                        readonly: false,
                        alttext: "Select destination folder",
                        filedir: true,
                        filesave: false,
                        fileaddnew: false,
                        filetextedit: false,
                        filebase: "/",
                        filerelative: false,
                        onchange: destinationChangedCallback,
                        comment: "Destination folder to sync"
                    }, {
                        param: "delay",
                        text: "Delay",
                        value: aData.delay,
                        type: "number",
                        min: 0,
                        max: 500,
                        step: 1,
                        disabled: false,
                        readonly: false,
                        comment: "Defines the delay between writing something to the source folder and starting to sync in seconds. This is to prevent syncing while still writing data. (default = 10 seconds)"
                    }, {
                        param: "resettimer",
                        text: "Reset timer",
                        value: aData.resettimer,
                        type: "boolean",
                        disabled: false,
                        readonly: false,
                        comment: "Defines whether to reset the timer (start the delay again) when writing data during the delay time. Default is true."
                    }, {
                        param: "initsync",
                        text: "Init sync",
                        value: aData.initsync,
                        type: "boolean",
                        disabled: false,
                        readonly: false,
                        comment: "Defines whether to sync on the program start. Default is false."
                    }, {
                        param: "reversesync",
                        text: "Reverse sync",
                        value: aData.reversesync,
                        type: "boolean",
                        disabled: false,
                        readonly: false,
                        comment: "Defines whether to sync to source when a file or folder on the target changes. Default is false."
                    }, {
                        param: "retry",
                        text: "Retry",
                        value: aData.retry,
                        type: "boolean",
                        disabled: false,
                        readonly: false,
                        comment: "Defines whether to keep retrying setting up a connection, e.g. when source or destination is not mounted (yet). Retry is done silent with a 10 second delay. Default is false."
                    }, {
                        param: "delete",
                        text: "Delete",
                        value: aData.delete,
                        type: "boolean",
                        disabled: false,
                        readonly: false,
                        comment: "Defines whether to delete file on the destination (see rsync delete). Default is true."
                    }, {
                        param: "exclude",
                        text: "Exclude",
                        value: cs2arr(aData.exclude),
                        type: "multi",
                        disabled: false,
                        readonly: false,
                        comment: "Defines patterns to be excluded from syncing (see rsync exclude). Default is empty."
                    }, {
                        param: "include",
                        text: "Include",
                        value: cs2arr(aData.include),
                        type: "multi",
                        disabled: false,
                        readonly: false,
                        comment: "Defines patterns to be included in syncing (see rsync include). Default is empty."
                    }, {
                        param: "compress",
                        text: "Compress",
                        value: aData.compress,
                        type: "boolean",
                        disabled: false,
                        readonly: false,
                        comment: "Defines whether to compress files to be synced (see rsync compress). Default is true."
                    }, {
                        param: "update",
                        text: "Update",
                        value: aData.update,
                        type: "boolean",
                        disabled: false,
                        readonly: false,
                        comment: "Defines whether to update files to be synced (see rsync update). Default is true."
                    }, {
                        param: "options",
                        text: "Options",
                        value: cs2arr(aData.options),
                        type: "multi",
                        disabled: false,
                        readonly: false,
                        comment: "Defines options added to rsync (see rsync manual). Contents is not checked. Default is empty."
                    }
                ];
                if (this.hasXnas) {
                    dlgData.splice(1, 0, {
                        param: "safesync",
                        text: "Safe reference",
                        value: safesync,
                        type: "boolean",
                        disabled: false,
                        readonly: false,
                        onchange: safesyncChangedCallback,
                        comment: "With safe reference an Xnas share is used, instead of any folder"
                    });
                }
                var title = "";
                if (name == null) {
                    let iName = "";
                    iName = generateUniqueName(this.jobs, aData.source, aData.destination);
                    dlgData.splice(0, 0, {
                        param: "name",
                        text: "Job name",
                        value: iName,
                        type: "text",
                        disabled: false,
                        readonly: false,
                        comment: "Enter a unique name for the job here"
                    });
                    title = "Add sync job";
                } else {
                    title = "Edit sync job: " + name;
                }
                setTimeout(function () {
                    dialog.build(title, dlgData, cbOk);
                    dialog.setEditButtonDisabled(!sourceValid || !destinationValid);
                }, 300);
            }
        };
        var sourceValidCallback = function(valid) {
            sourceValid = valid;
            dialog.setEditButtonDisabled(!sourceValid || !destinationValid);
        }
        var destinationValidCallback = function(valid) {
            destinationValid = valid;
            dialog.setEditButtonDisabled(!sourceValid || !destinationValid);
        }
        var sourceChangedCallback = function(param, src) {
            aData.source = src;
            if (name == null) {
                let iName = "";
                iName = generateUniqueName(this.jobs, aData.source, aData.destination);
                dialog.updateData([{
                    param: "name",
                    value: iName
                }]);
            }
            this.folderExists(aData.source, sourceValidCallback);
        };
        var destinationChangedCallback = function(param, dst) {
            aData.destination = dst;
            if (name == null) {
                let iName = "";
                iName = generateUniqueName(this.jobs, aData.source, aData.destination);
                dialog.updateData([{
                    param: "name",
                    value: iName
                }]);
            }
            this.folderExists(aData.destination, destinationValidCallback);
        };

        var cbOk = function(rData) {
            rData.exclude = data2str(rData.exclude);
            rData.include = data2str(rData.include);
            rData.options = data2str(rData.options);
            this.addEdit(rData, name, aData);
        }
        var safeEnable = false;
        if (name == null) {
            safeEnable = this.hasXnas;
        } else {
            safeEnable = this.isSafe(aData.source, aData.destination);
        }
        this.folderExists(aData.source, sourceValidCallback);
        this.folderExists(aData.destination, destinationValidCallback);
        safesyncChangedCallback.call(this, null, safeEnable);
    }

    xnasInstalled(callback) {
        var command = ["/usr/bin/which", "xnas"];
        var cbDone = function(rData) {
            if (callback) {
                callback.call(this, true);
            }
        };
        var cbFail = function(message, rData) {
            if (callback) {
                callback.call(this, false);
            }
        };
        return cockpit.spawn(command, { err: "out" })
        .done(cbDone.bind(this))
        .fail(cbFail.bind(this));
    }

    getXshares(callback) {
        // read /shares folder contents
        var command = ["/usr/bin/ls", "-1", "--classify", "--color=never", "/shares"];
        var cbDone = function(rData) {
            var aData = rData.split("\n");
            aData = aData.filter(n => n);
            aData = aData.filter(n => (n.slice(-1) == "/"));
            var bData = [];
            aData.forEach(n => {
                if (n.endsWith("/")) {
                    n = n.slice(0,-1);
                }
                bData.push(n);
            });
            if (callback) {
                callback.call(this, bData);
            }
        };
        var cbFail = function(message, rData) {
            var aData = [];
            if (callback) {
                callback.call(this, aData);
            }
        };
        return cockpit.spawn(command, { err: "out" })
        .done(cbDone.bind(this))
        .fail(cbFail.bind(this));
    }

    folderExists(folder, callback) {
        var command = ["/usr/bin/test", "-d", folder];
        var cbDone = function(rData) {
            if (callback) {
                callback.call(this, true);
            }
        };
        var cbFail = function(message, rData) {
            if (callback) {
                callback.call(this, false);
            }
        };
        return cockpit.spawn(command, { err: "out" })
        .done(cbDone.bind(this))
        .fail(cbFail.bind(this));
    }

    isSafe(source, destination) {
        return (this.hasXnas && (this.folder2safe(source) != "") && (this.folder2safe(destination) != ""));
    }

    folder2safe(folder) {
        var safe = "";

        if (folder.endsWith("/")) {
            folder = folder.slice(0,-1);
        }
        var folders = folder.split("/");
        if (folders.length == 3) {
            if (folders[1] == "shares") {
                safe = folders[2];
            }
        }
        return safe;
    }

    safe2folder(safe) {
        return "/shares/" + safe;
    }

    addEdit(rData, name, aData) {
        var addJob = false;
        var opts = {};
        if ("name" in rData) {
            name = rData.name;
            addJob = true;
            aData = {};
        }
        opts = buildOpts(rData, aData, ["name", "safesync"]);
        if (name) {
            if ((addJob) && (this.jobs.includes(name))) {
                new msgBox(this, "Existing sync job name " + name, "Please enter a unique name for the job");
            } else if (opts.length == 0) {
                new msgBox(this, "No changes to the sync job", "Job not edited");
            } else {
                var cbYes = function() {
                    this.pane.showSpinner("Adding/ editing...");
                    runCmd.call(this, this.displayContent, ["add", name], opts);
                };
                var txt = "";
                if (addJob) {
                    txt = "Are you sure to add " + name + " as sync job?";
                } else {
                    txt = "Are you sure to edit " + name + " as sync job?";
                }
                new confirmDialog(this, "Add/ edit sync job " + name, txt, cbYes);
            }
        } else {
            new msgBox(this, "Empty sync job name", "Please enter a valid name for the job");
        }
    }

    enable(data) {
        var cbYes = function() {
            this.pane.showSpinner("Enabling...");
            runCmd.call(this, this.getJobs, ["add", data.job], {"enabled": true});
        };
        var txt = "Are you sure to enable " + data.job + "?" + "<br>" +
                    "This item will automatically sync!"
        new confirmDialog(this, "Enable " + data.job, txt, cbYes);
    }

    disable(data) {
        var cbYes = function() {
            this.pane.showSpinner("Disabling...");
            runCmd.call(this, this.getJobs, ["add", data.job], {"enabled": false});
        };
        var txt = "Are you sure to disable " + data.job + "?" + "<br>" +
                    "This item will not automatically sync anymore!"
        new confirmDialog(this, "Disable " + data.job, txt, cbYes);
    }

    delete(data) {
        var cbYes = function() {
            this.pane.showSpinner("Deleting...");
            runCmd.call(this, this.getJobs, ["del", data.job]);
        };
        var txt = "Are you sure to delete " + data.job + "?" + "<br>" +
                    "This item will be deleted from database!";
        new confirmDialog(this, "Delete " + data.job, txt, cbYes);
    }
}

/////////////////////
// Common functions //
//////////////////////

function runCmd(callback, args = [], json = null, cmd = "/opt/syncwatch/syncwatch-cli.py") {
    var cbDone = function(data) {
        callback.call(this, data);
    };
    var cbFail = function(message, data) {
        callback.call(this, "[]");
        new msgBox(this, "Syncwatch command failed", "Command error: " + (data ? data : message + "<br>Please check the log file"));
    };
    var command = [cmd];
    command = command.concat(args);
    if (json) {
        command = command.concat(JSON.stringify(json));
    }
    return cockpit.spawn(command, { err: "out", superuser: "require" })
        .done(cbDone.bind(this))
        .fail(cbFail.bind(this));
}

function buildOpts(data, refData = {}, exclude = []) {
    var opts = {};

    for (let key in data) {
        let addKey = true;
        if (exclude.includes(key)) {
            addKey = false;
        } else if (key in refData) {
            if (data2str(data[key]) == data2str(refData[key])) {
                addKey = false;
            }
        }
        if (addKey) {
            opts[key] = data[key];
        }
    }
    return opts;
}

function data2str(data) {
    var str = "";
    if (Array.isArray(data)) {
        str = data.map(s => s.trim()).join(",");
    } else {
        str = data.toString();
    }
    return str;
}

function cs2arr(data, force = true) {
    var arr = [];
    if ((force) || (data.includes(","))) {
        arr = data.split(",").map(s => s.trim());
    } else {
        arr = data;
    }

    return arr;
}

function generateUniqueName(list, source = "", destination = "") {
    var name = "sync";
    var pname = "";
    var i = 1;

    if (source) {
        name += "_" + decodeName(source);
    }

    if (destination) {
        name += "_" + decodeName(destination);
    }

    if (!name) {
        name = randomString();
    }

    pname = name;

    while (list.includes(name)) {
        name = pname + i.toString();
        i++;
    }

    return name;
}

function decodeName(value) {
    var name = "";

    if (value == "/") {
        name = "_root_";
    } else {
        name = value.substring(value.lastIndexOf('/') + 1);
    }

    return name;
}

function randomString(stringLength = 8) {
    var result           = '';
    var characters       = 'abcdefghijklmnopqrstuvwxyz';
    var charactersLength = characters.length;
    for ( var i = 0; i < stringLength; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

///////////////////////////
// Tab display functions //
///////////////////////////

function clickTab() {
    // remove active class from all elements
    document.querySelectorAll('[role="presentation"]').forEach(function (el) {
        el.classList.remove("active");
        el.getElementsByTagName("a")[0].setAttribute("tabindex", -1);
        el.getElementsByTagName("a")[0].setAttribute("aria-selected", false);
    });

    // add class 'active' to this element
    this.classList.add("active")
    this.getElementsByTagName("a")[0].setAttribute("aria-selected", true);
    this.getElementsByTagName("a")[0].removeAttribute("tabindex");

    // hide all contents
    document.querySelectorAll('[role="tabpanel"]').forEach(function (el) {
        el.setAttribute("aria-hidden", true);
        el.classList.remove("active");
        el.classList.remove("in");
    });

    // show current contents
    contentId = this.getElementsByTagName("a")[0].getAttribute("aria-controls");
    el = document.getElementById(contentId);

    el.setAttribute("aria-hidden", false);
    el.classList.add("active");
    el.classList.add("in");
    displayContent(el);
}

function displayContent(el) {
    if (el.id.search("jobs") >= 0) {
        let Jobs = new syncJobs(el);
        Jobs.displayContent();
    } else if (el.id.search("log") >= 0) {
        let Logger = new logger(el, "/var/log/syncwatch.log");
        Logger.displayContent();
    }
}

function displayFirstPane() {
    displayContent(document.querySelectorAll('[role="tabpanel"]')[0]);
}

document.querySelectorAll('[role="presentation"]').forEach(function (el) {
    el.addEventListener("click", clickTab);
});

displayFirstPane();

// Send a 'init' message.  This tells integration tests that we are ready to go
cockpit.transport.wait(function() { });
