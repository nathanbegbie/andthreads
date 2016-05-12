
"""rename.py: rename a bunch of jpg files to a numerical name."""

import os
import re

pattern = re.compile(r'.*\.jpg')

mypath = os.path.dirname(os.path.realpath(__file__))

files = [f for f in os.listdir(mypath) if
         os.path.isfile(os.path.join(mypath, f)) and pattern.match(f)]

for file in files:
    # number = file[file.find('(') + 1:file.find(')')]
    os.rename(file, '0' + file)
