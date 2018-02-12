# Dictionaries script list

Here is existing dictionaries script list. You can copy script path in path column and paste it in option page **Dicts. Script** field. Click <kbd>Load Script</kbd> button to load.

## Path and Nameing Convention

To shorten path and file name, here is the script and path naming convention.

prefix **odh://** = built-in script.

- example: odh://encn_Youdao means loading a **built-in** script `encn_Youdao.js`

prefix **lib://** = script located in *THIS* git repository

- example: lib://encn_Youdao means loading a script in **THIS** git repository at `https://rawgit.com/ninja33/ODH/master/encn_Youdao.js`

prefix **git://** = script located in **your own** git repository

- example: git://your-name/your-repo/your-branch/encn_Youdao means loading a script in this your own repository at `https://rawgit.com/your-name/your-repo/your-branch/encn_Youdao.js`

**Note: You don't need put .js at the end of script name.**

## Target Language: Chinese

|Source|Target|Descrition|Path|
|---|---|---|---|
|EN|CN|Bundle|odh://encn_List|
|EN|CN|Youdao|odh://encn_Youdao|
|EN|CN|Baicizhan|odh://encn_Baicizhan|
|EN|CN|Oxford|odh://encn_Oxford|
|EN|CN|Longman|odh://encn_Longman|
|EN|CN|Collins|odh://encn_Collinsn|
|EN|CN|Cambridge|odh://encn_Cambridge|

## Source Language: English

|Source|Target|Descrition|Path|
|---|---|---|---|
|EN|EN|UrbanDict|odh://enen_UrbanDict|
|EN|EN|Collins|lib://enen_Collins|
|EN|FR|Collins|lib://enfr_Collins|
|EN|FR|Cambridge|lib://enfr_Cambridge|

## Source Language: French

|Source|Target|Descrition|Path|
|---|---|---|---|
|FR|CN|Youdao|lib://frcn_Youdao|
|FR|EN|Collins|lib://fren_Collins|
|FR|EN|Cambridge|lib://fren_Cambridge|

More ...