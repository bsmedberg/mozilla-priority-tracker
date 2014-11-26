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
        self.connectargs = config['prioritytool']['database.connect.args']
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

        cursor.execute('''SELECT bugzilla_id, nickname FROM aliases''')
        aliases = dict(i for i in cursor)

        cursor.execute('''SELECT MAX(change_id) FROM projectchanges''')
        lastchange, = cursor.fetchone()

        return json.dumps({'areas': areas, 'stages': stages, 'projects': projects, 'aliases': aliases, 'lastchange': lastchange})

    @requires_db
    def new(self, cursor, area, priority, bugid, bugsync, summary, owner, notes):
        if bugid == '':
            bugid = None
        else:
            bugid = int(bugid)
        if owner == '':
            owner = None
        print "priority: ", priority
        if priority == '':
            priority = None
        else:
            priority = float(priority)
        bugsync = {'true': True, 'false': False}[bugsync]
        cursor.execute('''INSERT INTO projects
                          (area_id, priority, bugid, bugsync, summary, owner, notes, complete)
                          VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE)''',
                       (area, priority, bugid, bugsync, summary, owner, notes))
        return str(cursor.lastrowid)

    @requires_db
    def update(self, id, cursor, area=None, priority=None, bugid=None, bugsync=None,
               summary=None, owner=None, notes=None, complete=None, _sync_change=False):
        if not _sync_change in (True, False):
            raise ValueError("Unexpected value for _sync_change")

        keys = []
        values = []
        if area is not None:
            if area == '':
                area = None
            keys.append("area_id")
            values.append(area)
        if priority is not None:
            if priority == '':
                priority = None
            else:
                priority = float(priority)
            keys.append("priority")
            values.append(priority)
        if bugid is not None:
            if bugid == '':
                bugid = None
            else:
                bugid = int(bugid)
            keys.append("bugid")
            values.append(bugid)
        if bugsync is not None:
            bugsync = {"true": True, "false": False}[bugsync]
            keys.append("bugsync")
            values.append(bugsync)
        if summary is not None:
            keys.append("summary")
            values.append(summary)
        if owner is not None:
            if owner == '':
                owner = None
            keys.append("owner")
            values.append(owner)
        if notes is not None:
            keys.append("notes")
            values.append(notes)
        if complete is not None:
            complete = {"true": True, "false": False}[complete]
            keys.append("complete")
            values.append(complete)

        cursor.execute('SELECT ' + ' , '.join(keys) + \
                        ' FROM projects WHERE project_id = %s FOR UPDATE',
                       [id])
        oldvalues = cursor.fetchone()

        cursor.execute('UPDATE projects SET ' + \
                           ' , '.join([k + ' = %s' for k in keys]) + \
                           ' WHERE project_id = %s',
                       values + [id])

        cursor.executemany('INSERT INTO projectchanges (project_id, fieldname, oldvalue, newvalue, sync_change) VALUES (%s, %s, %s, %s, %s)',
                           [(id, keys[i], oldvalues[i], values[i], _sync_change) for i in range(0, len(keys))])

        return ''

dispatcher = cherrypy.dispatch.RoutesDispatcher()
dispatcher.controllers['root'] = Root()

def connect(route, action, methods=('GET'), **kwargs):
    c = {'method': methods}
    dispatcher.mapper.connect(route, controller='root', action=action,
                              conditions=c, **kwargs)

connect('/api/load', 'load')
connect('/api/write/new', 'new', methods=('POST'))
connect('/api/write/update/{id}', 'update', methods=('POST'))

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
