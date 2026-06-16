#### Description of Behavior Tree Components
Behavior trees are a hierarchical control architecture commonly used in robotics and game AI to model complex decision-making processes in a modular and reactive manner. A behavior tree is composed of nodes arranged in a tree structure, where each node represents either a control flow construct (e.g., sequence, selector) or an action (e.g., a task like “move robot” or a check like “is well saturated?”). These actions are referred to as ``behaviors" and can be defined parametrically, making them modular and reusable. 

Execution begins at the root and propagates downward through the tree in ticks, which are periodic updates that determine which actions should be run. Control nodes manage the order and logic of their child nodes, while leaf nodes perform specific behaviors. This structure enables the robot to respond dynamically to changes in the environment, retry failed actions, or prioritize critical operations without hard-coding rigid state transitions. Compared to finite state machines, behavior trees offer greater flexibility, reusability, and scalability. **Figures  - ** represent the behavior trees used for RoboCulture.

Each node in a behavior tree must return one of three statuses when ticked:

    - \verb|SUCCESS|: The node has completed its task successfully
    - \verb|FAILURE|: The node was unable to complete its task
    - \verb|RUNNING|: The node is still in progress and requires further ticks

These return statuses propagate upward and determine how control nodes (e.g., Sequence or Selector) behave. This mechanism allows behavior trees to remain reactive, handling task interruptions and conditional logic gracefully.

The control nodes govern the execution of their children. Two of the most commonly used control flow types are the Sequence and the Selector.

**
The Sequence node (“AND” node) ticks its children from left to right. It returns \verb|SUCCESS| only if all child nodes return \verb|SUCCESS|, \verb|FAILURE| immediately when any child returns \verb|FAILURE|, \verb|RUNNING| if a child returns \verb|RUNNING|, pausing execution until the next tick.

This structure is useful for defining a series of dependent steps, such as “grasp pipette,” “attach pipette tip,” “pipette media”, where each step must succeed for the overall task to complete. 
**
The Selector node (“OR” node) also ticks its children from left to right, but returns \verb|SUCCESS| as soon as any child returns \verb|SUCCESS|, \verb|FAILURE| only if all children return \verb|FAILURE|, \verb|RUNNING| if a child returns \verb|RUNNING|, pausing execution until the next tick.

This node is ideal for fallback strategies or priorities. For example, the \verb|Grasp Pipette| behavior tree in **Figure ** is defined using a Selector. Its left child checks if the \verb|holding_pipette| state is \verb|True|; if so, it returns \verb|SUCCESS| and the \verb|Grasp Pipette| tree immediately returns \verb|SUCCESS|. Otherwise, the left child will return \verb|FAILURE|, and will proceed to execute the right child, which defines a Sequence to grasp the pipette. 
The following behaviors were built for RoboCulture:

**

RoboCulture uses the \verb|dynamic_reconfigure| ROS package to manage parameters which are useful for the execution of the experiment. The package allows for the reconfiguration of parameters during execution, and also provides a graphical user interface. More information on the tunable parameters is provided in **Section **.
The \verb|SetExperimentState| behavior is used to programatically set, increment, or decrement one of the parameters stored in the dynamic reconfigure server. It always returns \verb|SUCCESS|. 
**

The \verb|CheckExperimentState| behavior evaluates the value of a runtime parameter exposed through the \verb|dynamic_reconfigure| server to control conditional branching in the behavior tree. The behavior evaluates the current value of a specified parameter against a desired target value using a comparison operator (e.g., equals, greater than, less than). If the condition holds, the behavior returns \verb|SUCCESS|; otherwise, it returns \verb|FAILURE|.

This node is often used to guard access to downstream actions, such as checking whether a pipette is currently held before attempting to grasp one.
**

The \verb|Perceive| behavior initiates a perception request via a ROS action server to the \verb|perception_node|, instructing it to search for a specified target in the scene. The node accepts as parameters the target type and an identifier (e.g., AprilTag ID or well number).

The behavior returns \verb|RUNNING| while the perception node is actively processing the goal. If perception completes successfully and the \verb|perception_node| begins publishing error vectors, the \verb|Perceive| behavior returns \verb|SUCCESS|. If perception fails (e.g., the target is not detected), it returns \verb|FAILURE|.
**

The \verb|Servo| behavior is used to command the robot’s end-effector toward a target pose, either through perception-guided visual feedback or predefined Cartesian displacements. In both cases, the behavior communicates with the robot’s \verb|control_node| by sending a goal via a ROS action server, which handles the underlying motion execution. When operating in visual servoing mode, \verb|Servo| minimizes a perception error vector provided by the perception node to align a target with a detected object such as an AprilTag or well. Alternatively, it can move the end-effector by a specified offset or an absolute position in the robot’s base frame, which are useful for open-loop motions like insertion, retraction, or coarse positioning.

\verb|Servo| returns \verb|RUNNING| while the robot is in motion, \verb|SUCCESS| when the goal is achieved, and \verb|FAILURE| if the target becomes undetectable or the motion is aborted. In the case of failure, the behavior cancels any active goals and halts the robot, allowing the tree to fallback and re-initialize its perception target.