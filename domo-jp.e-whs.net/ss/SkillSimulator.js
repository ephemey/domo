var ss;
var headxsl;
var bodyxsl;
var listxsl;
var jobsxml;

window.onload = function(){
    new AjaxReq('./head.xsl', 'head');
}
var AjaxReq = Class.create();
Object.extend(AjaxReq.prototype, {
    initialize: function(url, mode, parameters){
        var msec = new Date().getTime();
        var p = $H({cache:msec}).merge(parameters);
        new Ajax.Request(url, {
            method      : 'get',
            parameters  : p.toQueryString(),
            onSuccess   : function(req, json){
                AjaxSuccess(req, json, mode);
            },
            onFailure   : function(req, json){
                alert('ファイルの読み込みでエラーが発生しました。:FailureErr');
            },
            onException : function(request, e){
                alert(e.name + ': '+ e.message);
            }
        });
    }
});
var XSLTransform = Class.create();
Object.extend(XSLTransform.prototype, {
    initialize: function(element, xml, xsl){
        return Try.these(
            function(){element.innerHTML = xml.transformNode(xsl);},
            function(){
                var xsltp = new XSLTProcessor();
                xsltp.importStylesheet(xsl);
                var html = xsltp.transformToFragment(xml, window.document);
                element.innerHTML = '';
                element.appendChild(html);
            }
        ) || false;
    }
});

function AjaxSuccess(req, json, mode){
    switch(mode){
        case 'head':
            headxsl = req.responseXML;
            new AjaxReq('./body.xsl', 'body');
            break;
        case 'body':
            bodyxsl = req.responseXML;
            new AjaxReq('./jobs.xml', 'jobs');
            break;
        case 'jobs':
            jobsxml = req.responseXML;
            new XSLTransform($('sshead'), jobsxml, headxsl);

            var elements = document.getElementsByTagName('A');
            for(var i = 0; i < elements.length; i++){
                switch(elements[i].name){
                    case 'JobSelector':
                        Event.observe(elements[i], 'click', eval(elements[i].name));
                        break;
                    default:
                        break;
                }
            }
            break;
        case 'list':
            listxsl = req.responseXML;
            new AjaxReq('./jobs.xml', 'jobs2');
            break;
        case 'jobs2':
            jobsxml = req.responseXML;
            var newDoc = Try.these(
                function(){return new ActiveXObject('microsoft.XMLDOM');},
                function(){return document.implementation.createDocument('', '', null);}
            );
            newDoc.insertBefore(newDoc.createProcessingInstruction('xml', 'version="1.0"'), newDoc.childNodes[0]);
            newDoc.appendChild(jobsxml.documentElement.childNodes[Number((window.location.search).replace('?','') - 1)].cloneNode(true));
            new XSLTransform($('sslist'), newDoc, listxsl);
            break;
        default:
            break;
    }
}
Ajax.Responders.register({
    onCreate: function(){
        if(Ajax.activeRequestCount > 0){
            Element.show($('busy'));
        }
    },
    onComplete: function(){
        if(Ajax.activeRequestCount == 0){
            Element.hide($('busy'));
        }
    }
});

var BasicDefinition = Class.create();
Object.extend(BasicDefinition.prototype, {
    initialize: function(){
    },
    getId: function(){
        return this._id;
    },
    getName: function(){
        return this._name;
    },
    getLvl: function(){
        return Number(this._lvl);
    },
    getSp: function(){
        return Number(this._sp);
    }
});

var Job = Class.create();
Object.extend(Job.prototype, BasicDefinition.prototype);
Object.extend(Job.prototype,{
    initialize: function(xml){
        this._id   = xml.attributes[0].nodeValue;
        this._name = xml.attributes[1].nodeValue;
//平民初期レベル1の対応
//        this._lvl  = 10;
        if(this._id == 1){
            this._baselvl = 1;
        }else{
            this._baselvl = 10;
        }
        this._lvl  = this._baselvl;
//
        this._sp   = 0;
        this._wtr  = 0;
        this._drp  = 0;

        var n = 0;
        this.skills = new Array();
        for(var i = 0; i < xml.childNodes.length; i++){
            for(var j = 0; j < xml.childNodes[i].childNodes.length; j++){
                this.skills[n] = new Skill(xml.childNodes[i].childNodes[j]);
                this.skills[n].parents = this;
                n++;
            }
        }
    },
    setSp: function(i){
        this._sp = Number(i);
    },
    lvlUp: function(i, mode){
        if(this._lvl + i > 200){i = 200 - this._lvl;}

        if(mode == 'try'){
            if(i > 0){
                return true;
            }else{
                return false;
            }
        }else{
            if(i > 0){
                this._lvl += i;
                this._sp  += i * 3;
            }
        }
    },
    tryLvlUp: function(){
        return this.lvlUp(1, 'try');
    },
    lvlDown: function(i, mode){
        var wkLvl = 0;
        var wkSp  = 0;
        var lvl   = 0;

        wkLvl = this._lvl - i;
//        if(wkLvl < 10){wkLvl = 10;}
        if(wkLvl < this._baselvl){wkLvl = this._baselvl;}
        wkSp = this._sp;
        for(var i = 0; i < this.skills.length; i++){
            lvl = Number(this.skills[i].getLvl());
            if(lvl > 0){
                if(wkLvl < Number(this.skills[i].level[lvl].getJobLvl())){
                    wkLvl = Number(this.skills[i].level[lvl].getJobLvl());
                }
            }
        }
//        if(this._drp * 2 + 10 > wkLvl){
        if(this._drp > 0 && this._drp * 2 + 10 > wkLvl){
            wkLvl = this._drp * 2 + 10;
        }
        if(this._lvl > wkLvl){
            for(var i = this._lvl; i > wkLvl; i--){
                if(mode == 'ex'){
                    wkSp -= 3;
                }else{
                    if(wkSp < 3){
                        break;
                    }else{
                        wkSp -= 3;
                    }
                }
            }
            wkLvl = i;
        }
        if(mode == 'try'){
            if(this._lvl > wkLvl){
                return true;
            }else{
                return false;
            }
        }else{
            if(this._lvl > wkLvl){
                this._lvl = wkLvl;
                this._sp  = wkSp;
            }
        }
    },
    tryLvlDown: function(){
        return this.lvlDown(1, 'try');
    },
    exLvlDown: function(i){
        var wkLvl = 0;
        var lvl   = 0;

        wkLvl = this._lvl - i;
//        if(wkLvl < 10){wkLvl = 10;}
        if(wkLvl < this._baselvl){wkLvl = this._baselvl;}
        for(var j = 0; j < this.skills.length; j++){
            lvl = Number(this.skills[j].getLvl());
            if(lvl > 0){
                while(wkLvl < Number(this.skills[j].level[lvl].getJobLvl())){
                    this.skills[j].exLvlDown(1);
                    lvl = Number(this.skills[j].getLvl());
                    if(lvl == 0){break;}
                }
            }
        }
//        while(this._drp * 2 + 10 > wkLvl){
        while(this._drp > 0 && this._drp * 2 + 10 > wkLvl){
            this.exDrpDown(1);
        }
        this.lvlDown(i, 'ex');
    },
    wtrUp: function(i, mode){
        if(this._wtr + i > 20){i = 20 - this._wtr;}

        if(mode == 'try'){
            if(i > 0){
                return true;
            }else{
                return false;
            }
        }else{
            if(i > 0){
                this._wtr += i;
                this._sp  += i * 5;
            }
        }
    },
    tryWtrUp: function(){
        return this.wtrUp(1, 'try');
    },
    wtrDown: function(i, mode){
        var wkSp = this._sp;
        var wkWtr = this._wtr - i;
        if(wkWtr < 0){wkWtr = 0;}

        for(var i = this._wtr; i > wkWtr; i--){
            if(wkSp < 5){
                wkWtr = i;
                break;
            }else{
                wkSp -= 5;
            }
        }
        if(mode == 'try'){
            if(this._wtr > wkWtr){
                return true;
            }else{
                return false;
            }
        }else{
            if(this._wtr > wkWtr){
                this._wtr = wkWtr;
                this._sp  = wkSp;
            }
        }
    },
    tryWtrDown: function(){
        return this.wtrDown(1, 'try');
    },
    drpUp: function(i, mode){
        var wkDrp = parseInt((this._lvl - 10) / 2);
        if(this._drp + i > wkDrp){i = wkDrp - this._drp;}

        if(mode == 'try'){
            if(i > 0){
                return true;
            }else{
                return false;
            }
        }else{
            if(i > 0){
                this._drp += i;
                this._sp  += i;
            }
        }
    },
    tryDrpUp: function(){
        return this.drpUp(1, 'try');
    },
    drpDown: function(i, mode){
        if(i > this._drp){i = this._drp;}
        if(i > this._sp){i = this._sp;}

        if(mode == 'try'){
            if(i > 0){
                return true;
            }else{
                return false;
            }
        }else{
            if(i > 0){
                this._drp -= i;
                this._sp  -= i;
            }
        }
    },
    tryDrpDown: function(){
        return this.drpDown(1, 'try');
    },
    exDrpDown: function(i, mode){
        this._drp -= i;
        this._sp  -= i;
    },
    getWtr: function(){
        return Number(this._wtr);
    },
    getDrp: function(){
        return Number(this._drp);
    }
});

var Skill = Class.create();
Object.extend(Skill.prototype, BasicDefinition.prototype);
Object.extend(Skill.prototype,{
    initialize: function(xml){
        this._id   = xml.attributes[0].nodeValue;
        this._name = xml.attributes[1].nodeValue;
        this._lvl  = 0;

        this.level = new Array();
        for(var i = 0; i < xml.childNodes.length; i++){
            this.level[i + 1] = new Level(xml.childNodes[i]);
            this.level[i + 1].parents = this;
        }
    },
    lvlUp: function(i, mode){
        var wkLvl = 0;
        var wkSp  = 0;
        var lvl   = 0;
        var nextLvl = 0;

        lvl = this._lvl + i;
        if(lvl > this.level.length - 1){
            lvl = this.level.length - 1;
        }
        wkSp = Number(this.parents.getSp());
        for(wkLvl = this._lvl; wkLvl < lvl; wkLvl++){
            nextLvl = wkLvl + 1;
            if(this.level[nextLvl].hasPreSk()){
                var chkPreSk;
                for(var i = 0; i < this.level[nextLvl].preSks.length; i++){
                    if(!this.level[nextLvl].preSks[i].isDepend()){
                        chkPreSk = 'NG';
                        break;
                    }
                }
                if(chkPreSk == 'NG'){break;}
            }
            if(wkSp >= Number(this.level[nextLvl].getSp())){
                if(Number(this.parents.getLvl()) >= Number(this.level[nextLvl].getJobLvl())){
                    wkSp -= Number(this.level[nextLvl].getSp());
                }else{
                    break;
                }
            }else{
                break;
            }
        }
        if(mode == 'try'){
            if(this._lvl < wkLvl){
                return true;
            }else{
                return false;
            }
        }else{
            if(this._lvl < wkLvl){
                this._lvl = wkLvl;
                this.parents.setSp(wkSp);
            }
        }
    },
    tryLvlUp: function(){
        return this.lvlUp(1, 'try');
    },
    exLvlUp: function(i){
        var wkLvl = 0;
        var wkSp  = 0;
        var lvl   = 0;
        var nextLvl = 0;
        var wkPreSkLvl = 0;

        lvl = this._lvl + i;
        if(lvl > this.level.length - 1){
            lvl = this.level.length - 1;
        }
        if(Number(this.level[lvl].getJobLvl()) - Number(this.parents.getLvl()) > 0){
            this.parents.lvlUp(Number(this.level[lvl].getJobLvl()) - Number(this.parents.getLvl()));
        }
        for(wkLvl = this._lvl; wkLvl < lvl; wkLvl++){
            nextLvl = wkLvl + 1;
            if(this.level[nextLvl].hasPreSk()){
                for(var j = 0; j < this.level[nextLvl].preSks.length; j++){
                    if(!this.level[nextLvl].preSks[j].isDepend()){
                        wkPreSkLvl = Number(this.level[nextLvl].preSks[j].getLvl()) - Number(this.level[nextLvl].preSks[j].ref.getLvl());
                        if(wkPreSkLvl > 0){
                            this.level[nextLvl].preSks[j].ref.exLvlUp(wkPreSkLvl);
                        }
                    }
                }
            }
            wkSp += Number(this.level[nextLvl].getSp());
        }
        if(wkSp - Number(this.parents.getSp()) > 0){
            this.parents.lvlUp(parseInt((wkSp - Number(this.parents.getSp())) / 3 + Number(0.9)));
        }
        this.lvlUp(i);
    },
    lvlDown: function(i, mode){
        var wkLvl = 0;
        var wkSp  = 0;
        var lvl   = 0;

        lvl = this._lvl - i;
        if(lvl < 0){lvl = 0;}
        for(wkLvl = this._lvl; wkLvl > lvl; wkLvl--){
            if(this.level[wkLvl].hasHighSk()){
                var chkHighSk;
                for(var i = 0; i < this.level[wkLvl].highSks.length; i++){
                    if(!this.level[wkLvl].highSks[i].isDepend()){
                        chkHighSk = 'NG';
                        break;
                    }
                }
                if(chkHighSk == 'NG'){break;}
            }
            wkSp += Number(this.level[wkLvl].getSp());
        }
        if(mode == 'try'){
            if(this._lvl > wkLvl){
                return true;
            }else{
                return false;
            }
        }else{
            if(this._lvl > wkLvl){
                this._lvl = wkLvl;
                this.parents.setSp(Number(this.parents.getSp()) + wkSp);
            }
        }
    },
    tryLvlDown: function(){
        return this.lvlDown(1, 'try');
    },
    exLvlDown: function(i){
        var wkLvl = 0;
        var wkSp  = 0;
        var lvl   = 0;

        lvl = this._lvl - i;
        if(lvl < 0){lvl = 0;}
        for(wkLvl = this._lvl; wkLvl > lvl; wkLvl--){
            if(this.level[wkLvl].hasHighSk()){
                for(var j = 0; j < this.level[wkLvl].highSks.length; j++){
                    while(!this.level[wkLvl].highSks[j].isDepend()){
                        this.level[wkLvl].highSks[j].ref.exLvlDown(1);
                    }
                }
            }
        }
        this.lvlDown(i);
    },
    setLvl: function(i){
        var lvl = 0;
        lvl = i - this._lvl;
        if(0 < lvl){
            this.exLvlUp(lvl);
        }else if(lvl < 0){
            this.exLvlDown(Math.abs(lvl));
        }
    }
});
var Level = Class.create();
Object.extend(Level.prototype, BasicDefinition.prototype);
Object.extend(Level.prototype,{
    initialize: function(xml){
        this._joblvl    = Number(xml.childNodes[0].childNodes[0].nodeValue);
        this._sp        = Number(xml.childNodes[1].childNodes[0].nodeValue);
        this._hasPreSk  = false;
        this._hasHighSk = false;

        this.preSks = new Array();
        this.highSks = new Array();
        if(xml.childNodes.length == 3){
            this._hasPreSk = true;
            for(var i = 0; i < xml.childNodes[2].childNodes.length; i++){
                this.preSks[i] = new PreSkill(xml.childNodes[2].childNodes[i]);
            }
        }
    },
    getJobLvl: function(){
        return Number(this._joblvl);
    },
    getNextJobLvl: function(){
        if(this._joblvl + 1 > this.parents.level.length -1){
            return false;
        }else{
            return this._joblvl + 1;
        }
    },
    hasPreSk: function(){
        return Boolean(this._hasPreSk);
    },
    hasHighSk: function(){
        return Boolean(this._hasHighSk);
    },
    setHasHighSk: function(n){
        this._hasHighSk = Boolean(n);
    }
});
var PreSkill = Class.create();
Object.extend(PreSkill.prototype, BasicDefinition.prototype);
Object.extend(PreSkill.prototype,{
    initialize: function(xml){
        this._id   = xml.childNodes[0].childNodes[0].nodeValue;
        this._lvl  = Number(xml.childNodes[1].childNodes[0].nodeValue);
    },
    getName: function(){
        return this.ref.getName();
    },
    isDepend: function(){
        if(this._lvl <= Number(this.ref.getLvl())){
            return true;
        }else{
            return false;
        }
    }
});
var HighSkill = Class.create();
Object.extend(HighSkill.prototype, BasicDefinition.prototype);
Object.extend(HighSkill.prototype,{
    initialize: function(id, lvl){
        this._id  = id;
        this._lvl = Number(lvl);
    },
    getName: function(){
        return this.ref.getName();
    },
    isDepend: function(){
        if(this._lvl > Number(this.ref.getLvl())){
            return true;
        }else{
            return false;
        }
    }
});

var SkillSimulator = Class.create();
Object.extend(SkillSimulator.prototype,{
    initialize: function(id){
        this._id = id;
    },
    getId: function(){
        return this._id;
    },
    getData: function(xml){
        if(this._id > 0 && this._id <= xml.documentElement.childNodes.length){
            var job  = new Job(xml.documentElement.childNodes[this._id - 1]);
            for(var i = 0; i < job.skills.length; i++){
                for(var j = 1; j < job.skills[i].level.length; j++){
                    if(job.skills[i].level[j].hasPreSk()){
                        for(var k = 0; k < job.skills[i].level[j].preSks.length; k++){
                            var p = job.skills[i].level[j].preSks[k];
                            p.ref = job.skills[p.getId()];
                            var l = Number(p.getLvl());
                            if(p.ref.level[l].hasHighSk()){
                                n = p.ref.level[l].highSks.length;
                            }else{
                                n = 0;
                                p.ref.level[l].setHasHighSk(true);
                            }
                            p.ref.level[l].highSks[n] = new HighSkill(i, j);
                            p.ref.level[l].highSks[n].ref = job.skills[i];
                        }
                    }
                }
            }
            this.job = job;
        }
    }
});

function setControls(){
    Element.addMethods({
        setEnable: function(element){
           element = $(element);
            if(element.tagName == 'IMG'){
                switch(element.name){
                    case 'JobUp':
                        chgImage(element, 'up', ss.job.tryLvlUp());
                        break;
                    case 'JobDown':
                        chgImage(element, 'down', ss.job.tryLvlDown());
                        break;
                    case 'WtrUp':
                        chgImage(element, 'up', ss.job.tryWtrUp());
                        break;
                    case 'WtrDown':
                        chgImage(element, 'down', ss.job.tryWtrDown());
                        break;
                    case 'DrpUp':
                        chgImage(element, 'up', ss.job.tryDrpUp());
                        break;
                    case 'DrpDown':
                        chgImage(element, 'down', ss.job.tryDrpDown());
                        break;
                    case 'SkUp':
                        chgImage(element, 'up', ss.job.skills[element.className].tryLvlUp());
                        break;
                    case 'SkDown':
                        chgImage(element, 'down', ss.job.skills[element.className].tryLvlDown());
                        break;
                    case 'SetSkLvl':
                        chgImage(element, 'lvl', element.id <= ss.job.skills[element.className].getLvl());
                        break;
                    default:
                        break;
                }
            }
            return true;
        }
    });
    Element.addMethods({
        setNegativeColar: function(element){
            element = $(element);
            if(element.id == 'RestSp'){
                if(Number(element.value) < 0){
                    element.style.color = "#ff0000";
                    $('Sp').style.color = "#ff0000";
                }else{
                    element.style.color = "";
                    $('Sp').style.color = "";
                }
            }
        }
    });

    var elements = document.getElementsByTagName('IMG');
    for(var i = 0; i < elements.length; i++){
        switch(elements[i].name){
            case 'JobUp':
            case 'JobDown':
            case 'WtrUp':
            case 'WtrDown':
            case 'DrpUp':
            case 'DrpDown':
            case 'SkUp':
            case 'SkDown':
            case 'SetSkLvl':
                Event.observe(elements[i], 'click', eval(elements[i].name));
                break;
            default:
                break;
        }
        elements[i].setEnable();
    }
}
function chgImage(element, type, enable){
    if(element.enable != enable){
        if(type == 'up'){
            if(enable){
                element.src = imgUpArrow;
            }else{
                element.src = imgGrayUpArrow;
            }
        }else if(type == 'down'){
            if(enable){
                element.src = imgDownArrow;
            }else{
                element.src = imgGrayDownArrow;
            }
        }else if(type =='lvl'){
            if(enable){
                element.src = imgLvlGauge;
            }else{
                element.src = imgGrayLvlGauge;
            }
        }
    }
    element.enable = enable;
}

function JobUp(event){
    var i = 1;
    if(event.shiftKey){i = 10;}
    ss.job.lvlUp(i);
    refresh();
}
function JobDown(event){
    var i = 1;
    if(event.shiftKey){i = 10;}
    if(event.ctrlKey){
        ss.job.exLvlDown(i);
    }else{
        ss.job.lvlDown(i);
    }
    refresh();
}
function WtrUp(event){
    var i = 1;
    if(event.shiftKey){i = 3;}
    ss.job.wtrUp(i);
    refresh();
}
function WtrDown(event){
    var i = 1;
    if(event.shiftKey){i = 3;}
    ss.job.wtrDown(i);
    refresh();
}
function DrpUp(event){
    var i = 1;
    if(event.shiftKey){i = 3;}
    ss.job.drpUp(i);
    refresh();
}
function DrpDown(event){
    var i = 1;
    if(event.shiftKey){i = 3;}
    ss.job.drpDown(i);
    refresh();
}
function SkUp(event){
    var i = 1;
    if(event.shiftKey){i = 5;}
    if(event.ctrlKey){
        ss.job.skills[Event.element(event).className].exLvlUp(i);
    }else{
        ss.job.skills[Event.element(event).className].lvlUp(i);
    }
    refresh();
}
function SkDown(event){
    var i = 1;
    if(event.shiftKey){i = 5;}
    if(event.ctrlKey){
        ss.job.skills[Event.element(event).className].exLvlDown(i);
    }else{
        ss.job.skills[Event.element(event).className].lvlDown(i);
    }
    refresh();
}
function SetSkLvl(event){
    ss.job.skills[Event.element(event).className].setLvl(Event.element(event).id);
    refresh();
}

function refresh(){
    var elements = document.getElementsByTagName('IMG');
    for(var i = 0; i < elements.length; i++){
        elements[i].setEnable();
    }
    $('JobLvl').value = Number(ss.job.getLvl());
    $('RestSp').value = Number(ss.job.getSp());
    $('Wtr').value = Number(ss.job.getWtr());
    $('Drp').value = Number(ss.job.getDrp());
    for(var i = 0; i < ss.job.skills.length; i++){
        $('Sk' + i + 'Lvl').value = Number(ss.job.skills[i].getLvl());
    }
    $('RestSp').setNegativeColar();
}

function JobSelector(event){
    ss = new SkillSimulator(Event.element(event).id);
    var newDoc = Try.these(
        function(){return new ActiveXObject('microsoft.XMLDOM');},
        function(){return document.implementation.createDocument('', '', null);}
    );
    newDoc.insertBefore(newDoc.createProcessingInstruction('xml', 'version="1.0"'), newDoc.childNodes[0]);
    newDoc.appendChild(jobsxml.documentElement.childNodes[Number(ss.getId() - 1)].cloneNode(true));
    new XSLTransform($('ssbody'), newDoc, bodyxsl);
    ss.getData(jobsxml);
    setControls();
    refresh();
}
imgUpArrow       = new Image();
imgDownArrow     = new Image();
imgGrayUpArrow   = new Image();
imgGrayDownArrow = new Image();
imgLvlGauge      = new Image();
imgGrayLvlGauge  = new Image();
imgUpArrow       = './img/up.gif';
imgGrayUpArrow   = './img/g_up.gif';
imgDownArrow     = './img/down.gif';
imgGrayDownArrow = './img/g_down.gif';
imgLvlGauge      = './img/gauge.gif';
imgGrayLvlGauge  = './img/g_gauge.gif';