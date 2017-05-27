import React, { Component } from 'react'
import PropTypes from 'prop-types'
import CommitsState from './helpers/CommitsState'

const pathData = () => {
  return {
    data: [],
    moveTo (x, y) {
      this.data.push(`M${x},${y}`)
      return this
    },
    lineTo (x, y) {
      this.data.push(`L${x},${y}`)
      return this
    },
    value () {
      return this.data.join('')
    }
  }
}

class GitGraph extends Component {
  constructor (props) {
    super(props)
    this.commitsCount = 0
    if (props.commits && props.commits.length) {
      this.commitsCount = props.commits.length
    }
  }

  shouldComponentUpdate () {
    if (this.commitsCount === this.props.commits.length) {
      return false
    } else {
      this.commitsCount = this.props.commits.length
      return true
    }
  }

  posX = (col) => (col + 1) * this.props.colWidth
  posY = (row) => (row + 0.5) * this.props.rowHeight

  renderOrphansPathes (orphans, lastIndex) {
    const posX = this.posX
    const posY = this.posY
    const paths = orphans.map(orphan => {
      const strokeColor = orphan.lane.color
      const d = pathData()
        .moveTo(posX(orphan.lane.col), posY(lastIndex))
        .lineTo(posX(orphan.lane.col), posY(orphan.index))
        .value()
      const pathKey ='future_' + orphan.id
      return <path id={pathKey} key={pathKey} d={d} stroke={strokeColor} strokeWidth='2' fill='none' />
    })

    return paths
  }

  render () {
    const orphanage = new Map() // a place to shelter children who haven't found their parents yet
    let commits = this.props.commits
    const state = new CommitsState(commits)
    commits = Array.from(state.commits.values())
    const { circleRadius, colWidth, rowHeight } = this.props
    const posX = this.posX
    const posY = this.posY
    const pathProps = { strokeWidth: 2, fill: 'none' }

    let pathsList = []
    let circlesList = []
    let maxCol = 0
    commits.forEach((commit, commitIndex) => {
      if (!commit.isRoot) {
        // register parent count of this commit
        orphanage.set(commit.id, commit.parentIds.length)
      }
      maxCol = Math.max(maxCol, commit.col)

      const x = posX(commit.col)
      const y = posY(commitIndex)

      // draw path from current commit to its children
      const paths = commit.children.map((child) => {
        if (orphanage.has(child.id)) {
          const parentCount = orphanage.get(child.id) - 1
          if (parentCount <= 0) {
            orphanage.delete(child.id)
          } else {
            orphanage.set(child.id, parentCount)
          }
        }

        const childIndex = commits.indexOf(child)
        const pathKey = `p_${commit.id}_${child.id}`

        let d, strokeColor
        // case 1: child on the same col, draw a straight line
        if (child.col === commit.col) {
          d = pathData()
            .moveTo(x, y)
            .lineTo(posX(child.col), posY(childIndex))
            .value()
          strokeColor = child.lane.color
        }
        // case 2: child has one parent, that's a branch out
        else if (child.parentIds.length === 1) {
          d = pathData()
            .moveTo(x, y)
            .lineTo(posX(child.col), y - rowHeight/2)
            .lineTo(posX(child.col), posY(childIndex))
            .value()
          strokeColor = child.lane.color
        }
        // case 3: child has more than one parent
        else {
          // case 3-1: if current commit is base of merge, that's a branch out, too
          if (commit.isBaseOfMerge(child)) {
            d = pathData()
              .moveTo(x, y)
              .lineTo(posX(child.col), y - rowHeight/2)
              .lineTo(posX(child.col), posY(childIndex))
              .value()
            strokeColor = child.lane.color
          }
          // case 3-2: other than that, it's a merge
          else {
            d = pathData()
              .moveTo(x, y)
              .lineTo(x, posY(childIndex) + rowHeight/2)
              .lineTo(posX(child.col), posY(childIndex))
              .value()
            strokeColor = commit.lane.color
          }
        }

        return <path d={d} id={pathKey} key={pathKey} stroke={strokeColor} {...pathProps} />
      })

      const circle = (
        <circle
          key={`c_${commit.id}`}
          cx={x} cy={y} r={circleRadius}
          fill={commit.lane.color}
          strokeWidth='1'
          stroke='#fff'
        />)

      pathsList = paths.concat(pathsList)
      circlesList = circlesList.concat(circle)
    })

    const orphans = Array.from(orphanage.keys()).map(id => state.commits.get(id))
    pathsList = pathsList.concat(this.renderOrphansPathes(orphans, commits.length))
    const width = colWidth * (maxCol + 2)
    if (typeof this.props.onWidthChange === 'function') this.props.onWidthChange(width)

    return (
      <svg height={commits.length * rowHeight} width={colWidth * (maxCol + 2)} >
        {[...pathsList, ...circlesList]}
      </svg>
    )
  }
}


const { string, number, arrayOf, shape, } = PropTypes
const laneType = shape({ color: string.isRequired })

const commitShapeConfig = {
  id: string.isRequired,
  col: number.isRequired,
  lane: laneType,
}

const commitType = shape({
  ...commitShapeConfig,
  children: arrayOf(shape(commitShapeConfig)),
})

GitGraph.propTypes = {
  commits: arrayOf(commitType).isRequired,
  circleRadius: number.isRequired,
  colWidth: number.isRequired,
  rowHeight: number.isRequired,
}

export default GitGraph
