from setuptools import setup
import os

readme_path = os.path.join(os.path.dirname(__file__), 'README')

with open(readme_path) as f:
    README = f.read()

setup(
    name='mozilla-priority-tracker',
    version='0.1',
    packages=['prioritytool'],
    description='Firefox Platform Team task and backlog tracking tool',
    long_description=README,
    author='Benjamin Smedberg',
    author_email='benjamin@smedbergs.us',
    install_requires=[
        'cherrypy',
        'routes',
        'MySQL-python',
        'ujson',
    ]
)
