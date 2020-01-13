$(() => {

    console.log('SEND SUCESSSSSSSSSSSSSSS');

    let hashid = 0;
    let last_pose = null;
    let received_pose = null;
    let current_mode = null;
    let sweepid_cache = null;
    const socket = io();
    const mp_iframe = $('#showcase_iframe');

    const button = $('#button');
    button.on('click', () => { //Set the current page as the leader
        hashid = 1;
        console.log(hashid);
    });

    const iframe = mp_iframe.get(0);
    const api_key = '6f5de7bf268545b8ba336d829f673088';
    mp_iframe.add('load', showcaseLoader); //after iframe finish loading, call showcaseLoader()

    socket.on('hash', msg => {
        hashid = msg; //Each unique hash assigned on connection to the socket.io and server
        console.log(hashid); //The first person signed in is the leader
    });

    function showcaseLoader() {
        try {
            window.MP_SDK.connect(
                    mp_iframe.get(0), // iframe
                    api_key, // Your API key
                    '3.2' // SDK version
                )
                .then((sdk) => {

                    //sdk.Camera.pose = test_pose;
                    sdk.Camera.pose.subscribe((pose) => { //sends pose data continuously when camera moves
                        last_pose = pose;
                        if (hashid === 1) { //count is to slowdown sending data
                            socket.emit('sweepid', pose);
                        }
                    });
                    /*
                    sdk.on(sdk.Camera.Event.MOVE, () => {
                        console.log('CAMERRRRRRRRRRAAAAAAAA');

                    });
                    */

                    sdk.on(sdk.Mode.Event.CHANGE_END, (from, to) => {
                        if (hashid === 1 && to === 'mode.dollhouse') { //if leader is moving to dollhouse 
                            socket.emit('viewmode', last_pose.sweep); //send current sweep UUID thru 'viewmode' socket
                        }

                    });

                    socket.on('viewmode', (msg) => {
                        sweepid_cache = msg; //receive the current sweep UUID
                    });


                    sdk.on(sdk.Sweep.Event.ENTER, async () => {
                        if (hashid === 1) {
                            setTimeout(() => { //last sweep update
                                socket.emit('sweepid', last_pose); //delay the signaling so it waits to be last
                            }, 900);
                        } else {
                            //makes the transition from inside to dollhouse or floorplan
                            //delayed to be the last action
                            if (received_pose && received_pose.mode !== 'mode.transitioning') {
                                await sdk.Mode.moveTo(received_pose.mode, {
                                    position: received_pose.position,
                                    rotation: received_pose.rotation,
                                });
                            }
                        }

                    });

                    socket.on('sweepid', async msg => { //sync leader and client screen
                        if (hashid !== 1) {
                            received_pose = msg;
                            if (received_pose.mode === 'mode.dollhouse' || received_pose.mode === 'mode.floorplan') {
                                await sdk.Mode.moveTo(received_pose.mode, { //if it's outside of the house
                                    position: received_pose.position, //just rotate, don't go to any sweep
                                    rotation: received_pose.rotation,
                                });
                            } else {
                                if (sweepid_cache !== received_pose.sweep) {
                                    await sdk.Sweep.moveTo(msg.sweep, { //receives data and update camera
                                        position: msg.position, //navigate inside the house
                                        rotation: msg.rotation,
                                        mode: msg.mode,
                                        transition: sdk.Sweep.Transition.FLY,

                                    });
                                }
                            }
                            //await sdk.Camera.rotate(msg.rotation.x, msg.rotation.y, { speed: 30 });
                        }


                    });

                })
                .catch((e) => {
                    console.log('ERROR: ' + e);
                });
        } catch (e) {
            console.error('ERROR ' + e);
        }
    }
});