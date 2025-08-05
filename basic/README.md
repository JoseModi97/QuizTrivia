# Quiz Trivia Application

This project is a web-based trivia quiz application built with the Yii 2 framework. It allows users to register, log in, and test their knowledge with a variety of quiz questions. The application fetches trivia questions from the [Open Trivia DB](https://opentdb.com/).

## Features

*   **User Authentication:** Users can register for a new account and log in to access the quiz features.
*   **Quiz Customization:** Before starting a quiz, users can customize it by selecting:
    *   Category (e.g., General Knowledge, Sports, History)
    *   Difficulty (Easy, Medium, Hard)
    *   Question Type (Multiple Choice, True/False)
    *   Number of Questions
*   **Interactive Quiz:** The application provides an interactive quiz interface with a progress bar and a timer.
*   **Results:** After completing a quiz, users can see their results, including the number of correct/incorrect answers and the final score.
*   **Quiz History and Reports:** Logged-in users can view their past quiz history and see reports on their performance, such as score over time and performance by category.

## Sample Users

You can use the following sample users to log in and test the application:

*   **Username:** `admin`
*   **Password:** `admin`

*   **Username:** `demo`
*   **Password:** `demo`

To modify the username/password, please check out the code in `app\models\User::$users`.

DIRECTORY STRUCTURE
-------------------

      assets/             contains assets definition
      commands/           contains console commands (controllers)
      config/             contains application configurations
      controllers/        contains Web controller classes
      mail/               contains view files for e-mails
      models/             contains model classes
      runtime/            contains files generated during runtime
      tests/              contains various tests for the basic application
      vendor/             contains dependent 3rd-party packages
      views/              contains view files for the Web application
      web/                contains the entry script and Web resources



REQUIREMENTS
------------

The minimum requirement by this project template that your Web server supports PHP 7.4.


INSTALLATION
------------

### Install via Composer

If you do not have [Composer](https://getcomposer.org/), you may install it by following the instructions
at [getcomposer.org](https://getcomposer.org/doc/00-intro.md#installation-nix).

You can then install this project template using the following command:

~~~
composer create-project --prefer-dist yiisoft/yii2-app-basic basic
~~~

Now you should be able to access the application through the following URL, assuming `basic` is the directory
directly under the Web root.

~~~
http://localhost/basic/web/
~~~

### Install from an Archive File

Extract the archive file downloaded from [yiiframework.com](https://www.yiiframework.com/download/) to
a directory named `basic` that is directly under the Web root.

Set cookie validation key in `config/web.php` file to some random secret string:

```php
'request' => [
    // !!! insert a secret key in the following (if it is empty) - this is required by cookie validation
    'cookieValidationKey' => '<secret random string goes here>',
],
```

You can then access the application through the following URL:

~~~
http://localhost/basic/web/
~~~


### Install with Docker

Update your vendor packages

    docker-compose run --rm php composer update --prefer-dist
    
Run the installation triggers (creating cookie validation code)

    docker-compose run --rm php composer install    
    
Start the container

    docker-compose up -d
    
You can then access the application through the following URL:

    http://1.2.0.0:8000

**NOTES:** 
- Minimum required Docker engine version `17.04` for development (see [Performance tuning for volume mounts](https://docs.docker.com/docker-for-mac/osxfs-caching/))
- The default configuration uses a host-volume in your home directory `.docker-composer` for composer caches


CONFIGURATION
-------------

### Database

Edit the file `config/db.php` with real data, for example:

```php
return [
    'class' => 'yii\db\Connection',
    'dsn' => 'mysql:host=localhost;dbname=yii2basic',
    'username' => 'root',
    'password' => '1234',
    'charset' => 'utf8',
];
```

**NOTES:**
- Yii won't create the database for you, this has to be done manually before you can access it.
- Check and edit the other files in the `config/` directory to customize your application as required.
- Refer to the README in the `tests` directory for information specific to basic application tests.
