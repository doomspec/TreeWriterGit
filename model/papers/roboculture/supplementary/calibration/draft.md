The upper bound on the object‑position error,
\[
\|\delta^p_O\|
\;\le\;
\|R_\epsilon-I\|\,\bigl\|^p_O\bigr\|
+\|p_\epsilon\|,
\]
shows that _the farther the object is from the camera (\(\|^p_O\|\) is larger), the larger the world‑frame position error produced by extrinsic‑calibration inaccuracies.  In other words, rotational mis-alignment contributes a distance‑scaled error term that grows linearly with object–camera separation, while the translational mis-registration \(\|p_\epsilon\|\) adds a constant offset.

`` is the inertial or the world frame, `` is the camera frame, and `` is the robot tool or end-effector frame.
We assume that the errors of object pose estimation in the camera frame and the robot tool pose estimation using the robot encoders are negligible compared to the hand-eye calibration error.
We can write down:

l
^_ = ~^_~ ^_~ ^_
 = 
  ^_ & ^_  & 1 
  = 
 
  ^_ & ^_  & 1 
 
  
  ^_ ~ _\epsilon & ^_ + _\epsilon & 1 
 

  ^_ & ^_  & 1 
,

where `_\epsilon` and `_\epsilon` result from the camera calibration error. In the case of no error, `_\epsilon = ` and `_\epsilon=`. From this equation, we can compute ` ^_` as:

^_ 
&= \,^_ - \,^_ &= \,^_ \,^_ (_\epsilon - ) \,^_ 
    + \,^_ \,_\epsilon

Using the triangle inequality for vectors and matrix norm submultiplicative lemmas, we can deduce:

\| ^_ \|
&= \left\| ^_ \, ^_ \, ( _\epsilon - ) \, ^_ 
     + ^_ \, _\epsilon \right\| &\|^_\| \, \|^_\| \, \| _\epsilon -  \| \, \|^_\| 
     + \|^_\| \, \|_\epsilon\| &\| _\epsilon -  \| \, \|^_\| + \| _\epsilon \|.

This inequality therefore shows that, when the rotational portion of the calibration error is non‑zero (`_\epsilon\neq`), the upper bound on the object‑position estimation error _increases linearly with the camera–object distance_. That is, a larger `\|^_\|` yields a larger error.