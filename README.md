# Imageboard scraper

A nodejs script to search for key words/phrases in thread original posts on a board, and scrape all posts and/or media (images, webm, etc..) from posts in that thread.

To install (for node-fetch):
```
npm install
```

To run, searching for the words "hello" and "world":
```
node scraper -words "hello, world" -board g -interval 60 -media y -posts y
```
The script will create a ```threads``` folder, with a sub-folder for every board scraped. Inside those, it will create a new folder for every thread ID scraped. Here, media such as images and webms are saved, alongside a json file with the posts data.


| Flag        | Alternatives           | What it is  | Default |
| ---------------- |:-------------:| :-----:| :-----:  |
| -words    | -w | Comma separated string of words to search for | - |
| -board | -b  | The board to search | g  |
| -interval | -i | How long to wait between thread searching (in seconds) | 60 |
| -media | -m | If media should be downloaded (y or Y for yes, anything else for no) | n |
| -posts | -p | If posts should be downloaded. The unchanged data from the API is saved in a .json file in the respective folder. (y or Y for yes, anything else for no)  | y |