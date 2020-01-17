$(() => {
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

    const test = $('#btn-test');

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

                    test.on('click', () => { //Set the current page as the leader

                    });

                    //sdk.Camera.pose = test_pose;
                    sdk.Camera.pose.subscribe(async (current_pose) => { //sends pose data continuously when camera moves
                        last_pose = current_pose;
                        if (hashid === 1) {
                            let floorlevel = await sdk.Floor.getData();
                            socket.emit('sweepid', {
                                pose: last_pose,
                                floor: floorlevel.currentFloor
                            });
                        }
                    });
                    /*
                    sdk.on(sdk.Camera.Event.MOVE, () => {
                        console.log('CAMERRRRRRRRRRAAAAAAAA');
                    });
                    */

                    sdk.on(sdk.Mode.Event.CHANGE_END, (from, to) => {

                        if (hashid === 1 && (to === 'mode.dollhouse' || to === 'mode.floorplan')) { //if leader is moving to dollhouse 
                            socket.emit('viewmode', last_pose.sweep); //send current sweep UUID thru 'viewmode' socket
                        }

                    });

                    socket.on('viewmode', (msg) => {
                        sweepid_cache = msg; //receive the current sweep UUID
                    });

                    //sdk.on(sdk.Mode.Event.CHANGE_END)

                    sdk.on(sdk.Sweep.Event.ENTER, async () => {

                        if (hashid === 1) {
                            setTimeout(async () => { //last sweep update
                                let floorlevel = await sdk.Floor.getData();
                                socket.emit('sweepid', {
                                    pose: last_pose,
                                    floor: floorlevel.currentFloor
                                }); //delay the signaling so it waits to be last
                            }, 1300);
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

                    let counter = 0;

                    socket.on('sweepid', async msg => { //sync leader and client screen
                        if (hashid !== 1) {
                            received_pose = msg.pose;

                            if (received_pose.mode === 'mode.dollhouse' || received_pose.mode === 'mode.floorplan') {

                                setTimeout(() => {
                                    sdk.Mode.moveTo(received_pose.mode, { //if it's outside of the house
                                        position: received_pose.position, //just rotate, don't go to any sweep
                                        rotation: received_pose.rotation,
                                    })
                                    .catch(e => {
                                        console.log('Set mode error: ' + e);
                                    });
                                },1000);
                                

                                let cur_floor = await sdk.Floor.getData();
                                if (msg.floor !== undefined && msg.floor >= 0 && msg.floor !== cur_floor.currentFloor) {
                                    setTimeout(() => {
                                        sdk.Floor.moveTo(msg.floor);
                                    }, 700);
                                } else if (msg.floor === -1 && msg.floor !== cur_floor.currentFloor) {
                                    setTimeout(() => {
                                        sdk.Floor.showAll();
                                    }, 700);
                                }
                            } else {
                                console.log(received_pose.sweep);
                                if (received_pose.sweep) {
                                    if (sweepid_cache !== received_pose.sweep) {
                                        sdk.Sweep.moveTo(received_pose.sweep, { //receives data and update camera
                                                //rotation: received_pose.rotation,
                                                transition: sdk.Sweep.Transition.FLY,
                                            })
                                            .catch(e => {
                                                console.log('Set sweep error: ' + e);
                                            });
                                        counter += 1;

                                        if (counter === 15)

                                        {
                                            counter = 0;
                                            sdk.Camera.getPose().then((s) => {

                                                let horizontal = (received_pose.rotation.y - s.rotation.y) * -1;
                                                console.log(`first: ${received_pose.rotation.y}`);
                                                console.log(`second: ${s.rotation.y}`);

                                                if (horizontal > 180) {
                                                    horizontal *= -1;
                                                    horizontal = horizontal + 180;
                                                } else if (horizontal < -180) {
                                                    horizontal *= -1;
                                                    horizontal = horizontal - 180;
                                                }
                                                sdk.Camera.rotate(horizontal, (received_pose.rotation.x - s.rotation.x)).then(() => {
                                                    console.log('HORRRRRRRRRRRizontal: ' + horizontal);
                                                });

                                            });
                                        }



                                    }
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