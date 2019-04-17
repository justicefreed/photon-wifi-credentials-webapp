var base_url='http://192.168.0.1/'; // the designated host url for a photon in softAP mode

// this is a wrapper for some parameters that gets used to 
// manage various RSA operations using the Particle device public key. 
// RSA is used to encode the WiFi password for transmission and storage
// to the Photon device
var rsa=new RSAKey();   

// this will hold the Photon device public key
var public_key;

// this will hold the results of the WiFi network scan
var network_list;

// document elements for UI
var scanButton=document.getElementById('scan-button');
var initialConnectButton=document.getElementById('initial-connect-button');
var connectButton=document.getElementById('connect-button');
var connectFeedback=document.getElementById('connect-feedback');
var copyButton=document.getElementById('copy-button');
var showButton=document.getElementById('show-button');
var deviceID=document.getElementById('device-id');
var connectForm=document.getElementById('connect-form');
var scanDiv = document.getElementById('scan-div');

// ----------------------------------------------------------------------------------------------------------------
// these wrap get and post requests in the proper format for a Photon to parse.
var getRequest=function(request_url, request_callback){
    var oRequest=new XMLHttpRequest();
    oRequest.open('GET', request_url, true);
    oRequest.timeout=8000;
    oRequest.send();
    oRequest.onreadystatechange=function(){
        if(oRequest.readyState==4)if(request_callback){
            if(oRequest.status==200){
                if(request_callback.success) request_callback.success(JSON.parse(oRequest.responseText));
            }
            else if(request_callback.error) request_callback.error(oRequest.status, oRequest.responseText);
            if(request_callback.regardless) request_callback.regardless();
    }};
};

var postRequest=function(request_url, request_body, request_callback){
    var requestBodyJson=JSON.stringify(request_body);
    var oRequest=new XMLHttpRequest();
    oRequest.open('POST', request_url, true);
    oRequest.timeout=4000;
    oRequest.setRequestHeader('Content-Type', 'multipart/form-data');
    oRequest.send(requestBodyJson);
    oRequest.onreadystatechange=function(){
        if(oRequest.readyState==4)if(request_callback){
            if(oRequest.status==200){
                if(request_callback.success)request_callback.success(JSON.parse(oRequest.responseText));
            }
            else if(request_callback.error)request_callback.error(oRequest.status, oRequest.responseText);
            if(request_callback.regardless)request_callback.regardless();
    }};
};

// ----------------------------------------------------------------------------------------------------------------
// we can use this request to determine if a device is present and reachable aka "connect"
// this is a pre-requisite for being able to send a WiFi password within the WiFi config object
var public_key_callback={
    success:function(a){
        console.log('Public key: '+a.b);
        public_key=a.b;
        rsa.setPublic(public_key.substring(58, 58+256), public_key.substring(318, 318+6));
        initialConnectButton.innerHTML = 'Connect To Device'
        initialConnectButton.disabled = false;
        connectFeedback.innerHTML = 'Connection was successful!';
        enableButtons();
        scanDiv.style.display='block';
    }, 
    error:function(a, b){
        console.log(a);
        resetPage();
        connectFeedback.innerHTML = '<b>ERROR - Could not connect to Device, please retry.</b><br><br>Please make sure Device is in listening mode, and that you are connected to the PHOTON-XXXX wifi hotspot corresponding to the device.<br><br>  If you are connected to the hotspot, try turning your WiFi off and back on again.';
}};

var getDevicePublicKey = function(){
    console.log("Trying to contact device...");
    resetPage();
    initialConnectButton.innerHTML = '&nbsp&nbsp&nbsp Connecting... &nbsp&nbsp&nbsp';
    initialConnectButton.disabled = true;
    scanDiv.style.display='none';
    document.getElementById('connect-div').style.display='none';
    document.getElementById('networks-div').innerHTML = '';
    getRequest(base_url+'public-key', public_key_callback);
}

// ----------------------------------------------------------------------------------------------------------------
// This request gets a list of wifi networks and signal strength values
// use this to help select an SSID that is reachable by the device.
// this negates the need to select WiFi network config like encryption type
var scan_callback={
    success:function(a){
        network_list=a.scans;
        console.log('I found:');
        var b=document.getElementById('networks-div');
        b.innerHTML='';
        if(network_list.length>0) for(var c=0; c<network_list.length; c++){
        ssid=network_list[c].ssid;
        console.log(network_list[c]);
        add_wifi_option(b, ssid);
        document.getElementById('connect-div').style.display='block';
        }else b.innerHTML='<p class=\'scanning-error\'>No networks found.</p>';
    }, 
    error:function(a){
        console.log('Scanning error:'+a);
        document.getElementById('networks-div').innerHTML='<p class=\'scanning-error\'>Scanning error.</p>';
    }, 
    regardless:function(){
        scanButton.innerHTML='Re-Scan';
        enableButtons();
        document.getElementById('networks-div').style.display='block';
}};

var scan=function(){
    console.log('Scanning...!');
    disableButtons();
    scanButton.innerHTML='Scanning...';
    connectButton.innerHTML='Connect';
    document.getElementById('connect-div').style.display='none';
    document.getElementById('networks-div').style.display='none';
    getRequest(base_url+'scan-ap', scan_callback);
};

// ----------------------------------------------------------------------------------------------------------------
// This sends over a WiFi configuration object to the photon.  It requires getting the password from
// somewhere, in this case from a document element.
var configure_callback={
    success:function(a){
        console.log('Credentials received.');
        connectButton.innerHTML='Credentials received... Resetting Device';
        reset();
        connectFeedback.innerHTML="New WiFi credentials received.<br><br>The device will reset and attempt to connect. <br><br>If the Device enters listening mode again, the credentials could not be used to successfully connect and you will need to retry";
        resetPage();
    }, 
    error:function(a, b){
        console.log('Configure error: '+a);
        window.alert('The configuration command failed,  check that you are still well connected to the device\'s WiFi hotspot and retry.');
        connectButton.innerHTML='Retry';
        enableButtons();
}};

var configure=function(a){
    a.preventDefault();
    var b=get_selected_network();
    var c=document.getElementById('password').value;
    if(!b){
        window.alert('Please select a network!');
        return false;
    }
    var d={idx:0, ssid:b.ssid, pwd:rsa.encrypt(c), sec:b.sec, ch:b.ch};
    connectButton.innerHTML='Sending credentials...';
    disableButtons();
    console.log('Sending credentials: '+JSON.stringify(d));
    postRequest(base_url+'configure-ap', d, configure_callback);
};

// ----------------------------------------------------------------------------------------------------------------
// this calls a special function to reset the device, which will subsequently attempt a connection
var reset_callback={
    success:function(a){
        console.log("reset request succeeded");
    }, 
    error:function(a, b){
        console.log("reset request timed out or had an error");
    }
};

var reset = function(){
    console.log("Resetting device");
    getRequest(base_url+'reset', {}, reset_callback);   // won't call callback ever, just will reset
};

// ----------------------------------------------------------------------------------------------------------------
// these are functions for the DOM control
var disableButtons=function(){
    connectButton.disabled=true;
    scanButton.disabled=true;
};

var enableButtons=function(){
    connectButton.disabled=false;
    scanButton.disabled=false;
};

var add_wifi_option=function(a, b){
    var c=document.createElement('INPUT');
    c.type='radio';
    c.value=b;
    c.id=b;
    c.name='ssid';
    c.className='radio';
    var d=document.createElement('DIV');
    d.className='radio-div';
    d.appendChild(c);
    var e=document.createElement('label');
    e.htmlFor=b;
    e.innerHTML=b;
    d.appendChild(e);
    a.appendChild(d);
};

var get_selected_network=function(){
    for(var a=0; a<network_list.length; a++){
    ssid=network_list[a].ssid;
    if(document.getElementById(ssid).checked) return network_list[a];
}};

var toggleShow=function(){
    var a=document.getElementById('password');
    inputType=a.type;
    if(inputType==='password'){
        showButton.innerHTML='Hide';
        a.type='text';
    }
    else{
        showButton.innerHTML='Show';
        a.type='password';
}};

var resetPage = function(){
    rsa=new RSAKey();
    public_key = "";
    scanButton.innerHTML='Scan';
    initialConnectButton.innerHTML = 'Connect To Device'
    initialConnectButton.disabled = false;
    scanDiv.style.display='none';
    document.getElementById('connect-div').style.display='none';
    document.getElementById('networks-div').innerHTML = '';
    enableButtons();
}

// ----------------------------------------------------------------------------------------------------------------
// event listeners
if(scanButton.addEventListener){
    initialConnectButton.addEventListener('click',  getDevicePublicKey);
    showButton.addEventListener('click', toggleShow);
    scanButton.addEventListener('click', scan);
    connectForm.addEventListener('submit', configure);
}
else if(scanButton.attachEvent){
    initialConnectButton.attachEvent('onclick',  getDevicePublicKey);
    showButton.attachEvent('onclick', toggleShow);
    scanButton.attachEvent('onclick', scan);
    connectForm.attachEvent('onsubmit', configure);
}


// // ----------------------------------------------------------------------------------------------------------------
// // unused request to get device id from photon
// var device_id_callback={
//     success:function(a){
//         var b=a.id;
//         deviceID.value=b;
//     }, 
//     error:function(a, b){
//     console.log(a);
//     var c='COMMUNICATION_ERROR';
//     deviceID.value=c;
// }};
// getRequest(base_url+'device-id', device_id_callback);
