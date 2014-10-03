import os
import datetime

import ujson as json
import cherrypy
import MySQLdb
import threading

anhour = datetime.timedelta(hours=1)

staticdir = os.path.abspath(os.path.dirname(__file__))

class ConnectionPool(object):
    def __init__(self, config):
        self.connectargs = config['priorityapi']['database.connect.args']
        self.lock = threading.Lock()
        self.connectpool = []

    def get(self):
        with self.lock:
            db = None
            while len(self.connectpool):
                db, lastused = self.connectpool.pop()
                if lastused > datetime.datetime.now() - anhour:
                    break

                db.close()
                db = None

        if db is None:
            db = MySQLdb.connect(charset='utf8', **self.connectargs)

        return db

    def done(self, db):
        with self.lock:
            self.connectpool.append((db, datetime.datetime.now()))

def requires_db(f):
    def inner(*args, **kwargs):
        db = cherrypy.request.app.connectionpool().get()
        try:
            cur = db.cursor()
            result = f(*args, cursor=cur, **kwargs)
            cur.close()
            db.commit()
            return result
        except:
            db.rollback()
            raise
        finally:
            cherrypy.request.app.connectionpool().done(db)
    return inner

class Root(object):
    @requires_db
    def load(self, cursor):
        cursor.execute('''SELECT area_id, projectname, lead
                          FROM areas
                          ORDER BY projectname''')
        areas = [{'id': id, 'name': name, 'lead': lead}
                 for id, name, lead in cursor]

        cursor.execute('''SELECT stage_id, priority, name
                          FROM stages
                          ORDER BY priority ASC''')
        stages = [{'id': id, 'priority': priority, 'name': name}
                  for id, priority, name in cursor]

        cursor.execute('''SELECT
                            project_id, area_id, last_change, priority,
                            bugid, bugsync, summary, owner, notes
                          FROM projects
                          WHERE complete = FALSE''')
        projects = [{'id': id, 'area': area, 'changed': changed,
                     'priority': priority, 'bugid': bugid, 'bugsync': bugsync,
                     'summary': summary, 'owner': owner, 'notes': notes}
                    for (id, area, changed, priority, bugid, bugsync, summary,
                         owner, notes) in cursor]

        return json.dumps({'areas': areas, 'stages': stages, 'projects': projects})

dispatcher = cherrypy.dispatch.RoutesDispatcher()
dispatcher.controllers['root'] = Root()

def connect(route, action, methods=('GET'), **kwargs):
    c = {'method': methods}
    dispatcher.mapper.connect(route, controller='root', action=action,
                              conditions=c, **kwargs)

connect('/api/load', 'load')

class Application(cherrypy.Application):
    _pool = None

    def __init__(self, script_name='', config=None):
        cherrypy.Application.__init__(self, None, script_name, config)
        self.merge({
            '/api': {
                'tools.encode.on': True,
                'tools.encode.encoding': 'utf-8',
                'tools.encode.add-charset': True,
                'request.dispatch': dispatcher,
            },
            '/': {
                'tools.staticdir.on': True,
                'tools.staticdir.root': staticdir,
                'tools.staticdir.dir': 'static',
                'tools.staticdir.index': 'index.html',
            },
        })

    def connectionpool(self):
        if self._pool is None:
            self._pool = ConnectionPool(self.config)
        return self._pool
