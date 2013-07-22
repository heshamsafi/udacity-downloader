var optimist = require("optimist");
var red, blue, reset;
red   = '\033[31m';
blue  = '\033[34m';
reset = '\033[0m';
if(optimist.argv.id.indexOf(",") > -1){
    var childProcess = require('child_process');
    var courses = optimist.argv.id.split(",");
    var generateArgs = function(argv,newId){
       var newArgv = [];
       for(var key in argv){
           if(key == "$0" || key == "_") continue;    
           newArgv.push("--"+key);
           
           newArgv.push((key == "id")?newId:argv[key]);
       }
       return newArgv;
    };
    var forkChildren = function(courses){
        var course = courses.shift();
        if(typeof course == "string") course = course.trim();
        else if(typeof course == "undefined") return;
        if(!course) return forkChildren(courses);
        console.log("\nStarting a process for "+red+course+reset+"\n");
        childProcess.fork(process.argv[1],generateArgs(optimist.argv,course)).on("exit",function(){
            return forkChildren(courses);
        });   
    };
    forkChildren(courses);
} else{
var request = require("request"),
    jsdom = require('jsdom'),
    fs = require("fs"),
    ProgressBar = require("progress"),
    async = require("async"),
    path = require('path');

request({
    uri: 'https://www.udacity.com/wiki/'+optimist.argv.id+'/downloads'
    }, function (err, response, body){
        try{
        jsdom.env({
            html: body,
            scripts: ['http://code.jquery.com/jquery-1.9.1.min.js'],
                done : function(err, window){
                    var $ = window.jQuery;
                    var $downloadLinks 
                                //= $("ul:eq(10),ul:eq(11)").find("li a[rel=nofollow]");
                                = $("ul li a[rel=nofollow]");
                    if(optimist.argv.regex){
                        $downloadLinks = $downloadLinks.filter(function(){
                              return this.innerHTML.trim().match(optimist.argv.regex);
                        });
                    }
                    if(optimist.argv.limit || optimist.argv.offset){
                        if(!optimist.argv.limit) optimist.argv.limit = $downloadLinks.length;
                        if(!optimist.argv.offset) optimist.argv.offset = 0;
                        $downloadLinks = $($downloadLinks.splice(optimist.argv.offset,optimist.argv.limit));
                    }
                    if(!$downloadLinks.length) return;
                    var length = $downloadLinks.length;
                    var courseName = ((optimist.argv["course-name"])?(optimist.argv["course-name"]+" - "):"")+optimist.argv.id;
                    console.log("course name : "+blue+courseName+reset);
                    console.log("found "+blue+length+reset+" file"+((length > 1)?"s":""));
                    var seriesFunctions = [];
                    $downloadLinks.each(function(index,downloadLink){
                        var $downloadLink = $(downloadLink);
                        var href = $downloadLink.attr("href");
                        var fname 
                        //    = href.match("/[^/]*$")[0].substring(1);
                        //or
                            = href.split("/").pop();
                        fname = decodeURIComponent(fname);
                        var seriesFunction = (function (boundObject,next){
                           var prefix = (optimist.argv.destination)?optimist.argv.destination:__dirname;
                           if(!prefix.match("/$")) prefix +=  "/";
                           prefix += boundObject.courseTitle+"/";
                           fs.mkdir(prefix,function(err){});
                           if(boundObject.$h2.length) prefix+=boundObject.$h2.text();
                           else prefix+= "Misc. Files";
                           fs.mkdir(prefix,function(err){});
                           fname = prefix+"/"+
                           fname;
                           var byteNo = 0;
                           try{
                                var stat = fs.statSync(fname);
                                if(stat.isFile()) byteNo = stat.size;
                            }catch(err){
                                //console.log(err);    
                            }
                            //console.log("starting at byte#"+byteNo);
                            var fd = fs.createWriteStream(fname, {'flags': 'a'});
                            var downloadRequest = request(
                            {
                                uri:href,
                                headers:{
                                    Range : 'bytes='+byteNo+'-'//to end
                                    //,"Accept-Charset" : "utf-8"
                                    ,"Connection":"keep-alive"
                                }
                            },function(){});
                            downloadRequest.on('response', function(res){
                                if(res.statusCode==416/*Requested Range Not Satisfiable*/){
                                    console.log(blue+fname+reset+" is Already Downloaded");
                                    downloadRequest.end();
                                    fd.close();
                                    next();
                                    return;
                                }
                                var len = parseInt(res.headers['content-length'], 10);//if it is chuncked then we are screwed :)
                                var bar = new ProgressBar(blue+boundObject.fname+reset+' [:bar] :percent, :elapsedm elapsed, :etam remaining, '+((len+byteNo)/(1024*1024)).toFixed(2)+'MB', { complete: '=', incomplete: ' ', width: 20, total: len+byteNo});
                                bar.tick(byteNo);
                                downloadRequest.on('data', function(chunk){
                                    fd.write(chunk, encoding='binary'); 
                                    bar.tick(chunk.length);
                                });
                                downloadRequest.on('end', function(){
                                    downloadRequest.end();
                                    fd.close();
                                    console.log();
                                    next();
                                });
                            });
                        }).bind(this,{"fname":fname,"index":index,"href":href,"$":$,"$h2":$downloadLink.parents("ul").prev("h2"),"courseTitle":courseName});
                        seriesFunctions.push(seriesFunction);
                    });
                    async.series(seriesFunctions,function(){
                        console.log();
                        console.log(blue+"Thats All, Folks !"+reset);
                        process.exit(0);//kill self
                        //it won't exit naturally, there must be a pending callback or something :\    
                    });
                 }
        });
        }catch(err){console.error(red+"ERROR : check your internet connection"+reset);}
    });
}
