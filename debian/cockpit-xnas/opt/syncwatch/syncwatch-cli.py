#!/usr/bin/python3

# -*- coding: utf-8 -*-
#########################################################
# SERVICE : syncwatch-cli.py                            #
#           Commandline interface for automating        #
#           syncwatch for commandline or application    #
#           I. Helwegen 2020                            #
#########################################################

####################### IMPORTS #########################
import sys
import os
import xml.etree.ElementTree as ET
from xml.dom.minidom import parseString
import json
import subprocess

#########################################################

####################### GLOBALS #########################
VERSION      = "0.80"
DAEMONSYNCWATCH = "syncwatch"
CMDNOTEXIST  = 127
CMDTIMEOUT   = 124
SYSTEMCTL    = "systemctl"
CTLSTART     = SYSTEMCTL + " start"
CTLSTOP      = SYSTEMCTL + " stop"
CTLRELOAD    = SYSTEMCTL + " reload"
CTLRESTART   = SYSTEMCTL + " restart"
CTLENABLE    = SYSTEMCTL + " enable"
CTLDISABLE   = SYSTEMCTL + " disable"
CTLSTATUS    = SYSTEMCTL + " status"
CTLISACTIVE  = SYSTEMCTL + " is-active"
CTLISENABLED = SYSTEMCTL + " is-enabled"
XML_FILENAME = "syncwatch.xml"
ENCODING     = 'utf-8'
#########################################################

###################### FUNCTIONS ########################

#########################################################
# Class : shell                                         #
#########################################################
class shell(object):
    def __init__(self):
        pass

    def __del__(self):
        pass

    def runCommand(self, cmd, input = None, timeout = None):
        CMDNOTEXIST = 127, "", ""
        if input:
            input = input.encode("utf-8")
        try:
            if timeout == 0:
                timout = None
            out = subprocess.run(cmd, shell=True, capture_output=True, input = input, timeout = timeout)
            retval = out.returncode, out.stdout.decode("utf-8"), out.stderr.decode("utf-8")
        except subprocess.TimeoutExpired:
            retval = CMDTIMEOUT, "", ""

        return retval

    def command(self, cmd, retcode = 0, input = None, timeout = None, timeoutError = False):
        returncode, stdout, stderr = self.runCommand(cmd, input, timeout)

        if returncode == CMDTIMEOUT and not timeoutError:
            returncode = 0
        if retcode != returncode:
            self.handleError(returncode, stderr)

        return stdout

    def commandExists(self, cmd):
        returncode, stdout, stderr = self.runCommand(cmd)

        return returncode != CMDNOTEXIST

    def handleError(self, returncode, stderr):
        exc = ("External command failed.\n"
               "Command returned: {}\n"
               "Error message:\n{}").format(returncode, stderr)
        raise Exception(exc)

#########################################################
# Class : systemdctl                                    #
#########################################################
class systemdctl(object):
    def __init__(self):
        self.hasSystemd = False
        try:
            self.hasSystemd = self.checkInstalled()
        except Exception as e:
            print("Error reading systemd information")
            print(e)
            exit(1)

    def __del__(self):
        pass

    def available(self):
        return self.hasSystemd

    def start(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLSTART, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def stop(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLSTOP, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def reload(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLRELOAD, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def restart(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLRESTART, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def enable(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLENABLE, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def disable(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLDISABLE, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def status(self, service):
        retval = []
        if self.available():
            cmd = "{} {}".format(CTLSTATUS, service)
            try:
                retcode, stdout, stderr = shell().runCommand(cmd)
                retval = stdout.splitlines()
            except:
                pass
        return retval

    def isActive(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLISACTIVE, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def isEnabled(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLISENABLED, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

################## INTERNAL FUNCTIONS ###################

    def checkInstalled(self):
        return shell().commandExists(SYSTEMCTL)

#########################################################
# Class : database                                      #
#########################################################
class database(object):
    def __init__(self):
        self.db = {}
        if not self.getXMLpath(False):
            # only create xml if super user, otherwise keep empty
            self.createXML()
            self.getXML()
        else:
            self.getXML()

    def __del__(self):
        del self.db
        self.db = {}

    def __call__(self):
        return self.db

    def update(self):
        self.updateXML()

    def reload(self):
        del self.db
        self.db = {}
        self.getXML()

    def bl(self, val):
        retval = False
        try:
            f = float(val)
            if f > 0:
                retval = True
        except:
            if val.lower() == "true" or val.lower() == "yes" or val.lower() == "1":
                retval = True
        return retval

################## INTERNAL FUNCTIONS ###################

    def gettype(self, text, txtype = True):
        try:
            retval = int(text)
        except:
            try:
                retval = float(text)
            except:
                if text:
                    if text.lower() == "false":
                        retval = False
                    elif text.lower() == "true":
                        retval = True
                    elif txtype:
                        retval = text
                    else:
                        retval = ""
                else:
                    retval = ""

        return retval

    def settype(self, element):
        retval = ""
        if type(element) == bool:
            if element:
                retval = "true"
            else:
                retval = "false"
        elif element != None:
            retval = str(element)

        return retval

    def getXML(self):
        XMLpath = self.getXMLpath()
        try:
            tree = ET.parse(XMLpath)
            root = tree.getroot()
            self.db = self.parseKids(root, True)
        except Exception as e:
            print("Error parsing xml file")
            print("Check XML file syntax for errors")
            print(e)
            exit(1)

    def parseKids(self, item, isRoot = False):
        db = {}
        if self.hasKids(item):
            for kid in item:
                if self.hasKids(kid):
                    db[kid.tag] = self.parseKids(kid)
                else:
                    db.update(self.parseKids(kid))
        elif not isRoot:
            db[item.tag] = self.gettype(item.text)
        return db

    def hasKids(self, item):
        retval = False
        for kid in item:
            retval = True
            break
        return retval

    def updateXML(self):
        db = ET.Element('syncs')
        pcomment = self.getXMLcomment("")
        if pcomment:
            comment = ET.Comment(pcomment)
            db.append(comment)
        self.buildXML(db, self.db)

        XMLpath = self.getXMLpath(dowrite = True)

        with open(XMLpath, "w") as xml_file:
            xml_file.write(self.prettify(db))

    def buildXML(self, xmltree, item):
        if isinstance(item, dict):
            for key, value in item.items():
                kid = ET.SubElement(xmltree, key)
                self.buildXML(kid, value)
        else:
            xmltree.text = self.settype(item)

    def createXML(self):
        print("Creating new XML file")
        db = ET.Element('syncs')
        comment = ET.Comment("This XML file describes the synchronizations to be done.\n"
        "            Add a sync to syncs to add a synchronization.")
        db.append(comment)

        XMLpath = self.getNewXMLpath()

        with open(XMLpath, "w") as xml_file:
            xml_file.write(self.prettify(db))

    def getXMLcomment(self, tag):
        comment = ""
        XMLpath = self.getXMLpath()
        with open(XMLpath, 'r') as xml_file:
            content = xml_file.read()
            if tag:
                xmltag = "<{}>".format(tag)
                xmlend = "</{}>".format(tag)
                begin = content.find(xmltag)
                end = content.find(xmlend)
                content = content[begin:end]
            cmttag = "<!--"
            cmtend = "-->"
            begin = content.find(cmttag)
            end = content.find(cmtend)
            if (begin > -1) and (end > -1):
                comment = content[begin+len(cmttag):end]
        return comment

    def prettify(self, elem):
        """Return a pretty-printed XML string for the Element.
        """
        rough_string = ET.tostring(elem, ENCODING)
        reparsed = parseString(rough_string)
        return reparsed.toprettyxml(indent="\t").replace('<?xml version="1.0" ?>','<?xml version="1.0" encoding="%s"?>' % ENCODING)

    def getXMLpath(self, doexit = True, dowrite = False):
        etcpath = "/etc/"
        XMLpath = ""
        # first look in etc
        if os.path.isfile(os.path.join(etcpath,XML_FILENAME)):
            XMLpath = os.path.join(etcpath,XML_FILENAME)
            if dowrite and not os.access(XMLpath, os.W_OK):
                print("No valid writable XML file location found")
                print("XML file cannot be written, please run as super user")
                if doexit:
                    exit(1)
        else: # Only allow etc location
            print("No XML file found")
            if doexit:
                exit(1)
        return XMLpath

    def getNewXMLpath(self):
        etcpath = "/etc/"
        XMLpath = ""
        # first look in etc
        if os.path.exists(etcpath):
            if os.access(etcpath, os.W_OK):
                XMLpath = os.path.join(etcpath,XML_FILENAME)
        if (not XMLpath):
            print("No valid writable XML file location found")
            print("XML file cannot be created, please run as super user")
            exit(1)
        return XMLpath


#########################################################

#########################################################
# Class : swcli                                         #
#########################################################
class swcli(object):
    def __init__(self):
        self.name = ""

    def __del__(self):
        pass

    def __str__(self):
        return "{}: commandline interface for syncwatch".format(self.name)

    def __repr__(self):
        return self.__str__()

    def run(self, argv):
        if len(os.path.split(argv[0])) > 1:
            self.name = os.path.split(argv[0])[1]
        else:
            self.name = argv[0]

        self.db = database()

        for arg in argv:
            if arg[0] == "-":
                if arg == "-h" or arg == "--help":
                    self.printHelp()
                    exit()
                elif arg == "-v" or arg == "--version":
                    print(self)
                    print("Version: {}".format(VERSION))
                    exit()
                else:
                    self.parseError(arg)
        if len(argv) < 2:
            self.lst()
        elif argv[1] == "add":
            opt = argv[1]
            if len(argv) < 3:
                opt += " <name>"
                self.parseError(opt)
            elif len(argv) < 4:
                opt += " <name> <json options>"
                self.parseError(opt)
            self.sadd(argv[2], argv[3])
        elif argv[1] == "del":
            opt = argv[1]
            if len(argv) < 3:
                opt += " <name>"
                self.parseError(opt)
            self.sdel(argv[2])
        elif argv[1] == "shw":
            opt = argv[1]
            if len(argv) < 3:
                opt += " <name>"
                self.parseError(opt)
            self.shw(argv[2])
        elif argv[1] == "ctl":
            opt = argv[1]
            if len(argv) < 3:
                opt += " <name>"
                self.parseError(opt)
            self.ctl(argv[2])
        else:
            self.parseError(argv[1])

    def printHelp(self):
        print(self)
        print("Usage:")
        print("    {} {}".format(self.name, "<argument> <name> <json options>"))
        print("    <arguments>")
        print("        add           : adds/ edits watch <name> with <json options>")
        print("        del           : deletes watch <name>")
        print("        shw           : shows options for watch <name>")
        print("        ctl           : controls daemon (start, stop, enable, disable, restart,")
        print("                                         reload, isactive, isenabled)")
        print("        <no arguments>: lists all watches")
        print("")
        print("JSON options may be entered as single JSON string using full name, e.g.")
        print("{}".format(self.name), end="")
        print(" add sync1 \"{'delete': true}\"")
        print("Mind the double quotes to bind the JSON string.")

    def parseError(self, opt = ""):
        print(self)
        print("Invalid option entered")
        if opt:
            print(opt)
        print("Enter '{} -h' for help".format(self.name))
        exit(1)

    def lst(self):
        dbLst = [] #enabled, source, destination, reversesync
        for item, value in self.db().items():
            try:
                dbItem = {}
                dbItem['job'] = item
                if "enabled" in value: # compatibility with syncwatch 0.8.4
                    dbItem['enabled'] = value['enabled']
                else:
                    dbItem['enabled'] = True
                dbItem['source'] = value['source']
                dbItem['destination'] = value['destination']
                dbItem['reversesync'] = value['reversesync']
                dbItem['delete'] = value['delete']
                dbLst.append(dbItem)
            except:
                pass
        print(json.dumps(dbLst))

    def sadd(self, name, opt):
        opts = {}
        try:
            opts = json.loads(opt)
        except:
            self.parseError("Invalid JSON format")
        item = self.getItem(name)
        if not item:
            item = self.buildDefault()
            self.db()[name] = item
        self.edit(item, opts)
        if not 'enabled' in item:
            if not os.path.isdir(item['source']):
                self.parseError("Source folder does not exist: {}".format(item['source']))
            elif not os.path.isdir(item['destination']):
                self.parseError("Destination folder does not exist: {}".format(item['destination']))
        self.db.update()
        self.ctl("restart")

    def sdel(self, name):
        item = self.getItem(name)
        if not item:
            self.parseError("<name> doesn't exist")
        del self.db()[name]
        self.db.update()
        self.ctl("restart")

    def shw(self, name):
        item = self.getItem(name)
        if not item:
            self.parseError("<name> doesn't exist")
        print(json.dumps(item))

    def ctl(self, opt):
        result = {}
        sctl = systemdctl()
        if not sctl.available():
            print("Reason: systemd unavailable on your distro")
            print("{} cannot automatically restart the {} service".format(self.name, DAEMONSYNCWATCH))
            print("You can try it yourself using a command like 'service {} restart'".format(DAEMONSYNCWATCH))
            self.parseError()
        if opt == "start":
            result['result'] = sctl.start(DAEMONSYNCWATCH)
        elif opt == "stop":
            result['result'] = sctl.stop(DAEMONSYNCWATCH)
        elif opt == "restart":
            result['result'] = sctl.restart(DAEMONSYNCWATCH)
        elif opt == "reload":
            result['result'] = sctl.reload(DAEMONSYNCWATCH)
        elif opt == "enable":
            result['result'] = sctl.enable(DAEMONSYNCWATCH)
        elif opt == "disable":
            result['result'] = sctl.disable(DAEMONSYNCWATCH)
        elif opt == "isactive":
            result['result'] = sctl.isActive(DAEMONSYNCWATCH)
        elif opt == "isenabled":
            result['result'] = sctl.isEnabled(DAEMONSYNCWATCH)
        else:
            self.parseError("Invalid ctl option: {}".format(opt))
        print(json.dumps(result))

    def getItem(self, name):
        itemvals = {}

        for item, value in self.db().items():
            if name.strip() == item.strip():
                itemvals = value
                break

        return itemvals

    def buildDefault(self):
        item = {}
        item['enabled'] = True
        item['source'] = ""
        item['destination'] = ""
        item['delay'] = 10
        item['resettimer'] = True
        item['initsync'] = False
        item['reversesync'] = False
        item['retry'] = False
        item['delete'] = True
        item['exclude'] = ""
        item['include'] = ""
        item['compress'] = True
        item['update'] = True
        item['options'] = ""
        return item

    def edit(self, item, opts):
        if 'enabled' in opts:
            item['enabled'] = self.db.bl(opts['enabled'])
        if 'source' in opts and type(opts['source']) == str:
            item['source'] = opts['source']
        if 'destination' in opts and type(opts['destination']) == str:
            item['destination'] = opts['destination']
        if 'delay' in opts and type(opts['delay']) == int:
            item['delay'] = opts['delay']
        if 'resettimer' in opts:
            item['resettimer'] = self.db.bl(opts['resettimer'])
        if 'initsync' in opts:
            item['initsync'] = self.db.bl(opts['initsync'])
        if 'reversesync' in opts:
            item['reversesync'] = self.db.bl(opts['reversesync'])
        if 'retry' in opts:
            item['retry'] = self.db.bl(opts['retry'])
        if 'delete' in opts:
            item['delete'] = self.db.bl(opts['delete'])
        if 'exclude' in opts and type(opts['exclude']) == str:
            item['exclude'] = opts['exclude']
        if 'include' in opts and type(opts['include']) == str:
            item['include'] = opts['include']
        if 'compress' in opts:
            item['compress'] = self.db.bl(opts['compress'])
        if 'update' in opts:
            item['update'] = self.db.bl(opts['update'])
        if 'options' in opts and type(opts['options']) == str:
            item['options'] = opts['options']
        return item

######################### MAIN ##########################
if __name__ == "__main__":
    swcli().run(sys.argv)
