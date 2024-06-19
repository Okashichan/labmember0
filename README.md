# labmember0
Publish posts from Danbooru to Telegram.
## deploy

> docker cp labmember0:/usr/src/app/db.json db.json # if already exists

>docker build -t labmember0 .

>docker run -d --restart=always --name labmember0 labmember0
### License
The source code for the site is licensed under the [MIT](LICENSE) license.