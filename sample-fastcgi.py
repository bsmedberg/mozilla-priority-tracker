#!/home/bsmedberg/apps/priority-tracker-env/bin/python

# SAMPLE CODE: How to run this tool with FastCGI using flup

try:
    import cherrypy
    cherrypy.config.update('/path/to/priority-tracker-global.ini')

    from prioritytool.main import Application
    # The path passed to Application is the mount-point of this application
    # on the website. e.g.
    # http://benjamin.smedbergs.us/firefox-platform-tracking.fcgi/
    app = Application('/firefox-platform-tracking.fcgi')

    cherrypy.tree.apps[''] = app
    app.merge('/path/to/priority-tracker.ini')
    from flup.server.fcgi import WSGIServer
    WSGIServer(app).run()
except:
    import traceback
    log = open('/path/to/priority-tracker.errlog', 'a')
    traceback.print_exc(None, log)
    log.close()
    raise
