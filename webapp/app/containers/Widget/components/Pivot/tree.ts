import Node from './node'
import cloneDeep from 'lodash/cloneDeep'
import { getOriginKey, isSumLastNode, isSumNodeEnd, isQuotaSum } from './util'
import { SumType, CategoryType } from './constants'
class MultiwayTree {
  public tree = {
    wideProps: {
      root: null,
      wideTableList: [],
      metrics: [],
      metricsAgg: [],
      metricsTotal: {},
      colArray: [],
      rowArray: [],
      resultWideList: [],
      resultWideListLast: [],
      metricNodeList: [],
      rowColConcat: [],
      rowLast: null,
      colLast: null
    },
    labelText: {
      rootLevel: { name_level0_cols: 'root' },
      rootKey: ['name_level0_cols'],
      sumConcat: ['总和', '合计'],
      sumText: '总和',
      subSumText: '合计'
    },
    nodeAttr: {
      originParentKey: '',
      level: {},
      samePathNode: {},
      nodeValue: null,
      listNumber: 0,
      levelCount: 0,
      initKey: '',
      label: '',
      sumType: '',     
      levelType: ''
    }
  }

  constructor() {}

  public getTraverseBF(callback) {
    const queue = []
    let found = false
    queue.push(this.tree.wideProps.root)
    let currentNode = queue.shift()

    while (!found && currentNode) {
      found = !!callback(currentNode)
      if (!found) {
        queue.push(...currentNode.children)
        currentNode = queue.shift()
      }
    }
    return found
  }

  public getContains(callback, traversal) {
    traversal.call(this, callback)
  }

  public getAddToData(obj, toData) {
    const metrics = this.tree.wideProps.metrics

    const node = new Node(obj, metrics)
    if (this.tree.wideProps.root === null) {
      this.tree.wideProps.root = node
      return this
    }
    const exitCallBack = function (currentNode) {
      if (currentNode.key === node.key && currentNode.label === node.label) {
        return true
      }
    }
    const exitTag = tree.getTraverseBF.call(this, exitCallBack)
    if (exitTag) {
      return this
    }

    let parent = null
    const callback = (node) => {
      if (node.key === toData.key) {
        parent = node
        return true
      }
    }
    this.getContains(callback, tree.getTraverseBF)
    if (parent) {
      parent.children.push(node)
      node.parent = parent
      return this
    } else {
      throw new Error()
    }
  }

  private getParentId(treeNodeGroup){
    const { listNumber, levelType, samePathNode } = this.tree.nodeAttr
    if (samePathNode) {
      return this.tree.nodeAttr.samePathNode.parentKey
    } else {
      if (levelType == CategoryType.Metrics) {
        return treeNodeGroup[treeNodeGroup.length - 1].key
      }
      if (!listNumber) {
        return this.tree.nodeAttr.originParentKey
      } else {
        return treeNodeGroup[treeNodeGroup.length - 1].key
      }
    }
  }
  // TODO refactor
  public getNodeLevelType(levelKey) {
    const isRow = [
      ...this.tree.wideProps.rowArray,
      ...this.tree.labelText.rootKey
    ].includes(levelKey)
    const isCol = this.tree.wideProps.colArray.includes(levelKey)
    let levelType
    if (isRow) {
      levelType = 'row'
    } else if (isCol) {
      levelType = 'col'
    } else {
      levelType = 'metrics'
    }
    return levelType
  }

  public getMultiwayTree() {
    this.tree.wideProps.wideTableList.forEach((listItem, listNumber) => {
      const treeNodeGroup = []
      const targetNodeGroup = []
      listItem = { ...this.tree.labelText.rootLevel, ...listItem }
      this.tree.nodeAttr.samePathNode = null
      Object.keys(listItem).forEach((levelKey, levelCount) => {
        const originParentKey = levelCount  ?  `${
          Object.keys(listItem)[levelCount - 1]
        }_${listNumber}` : null
        const initKey = `${levelKey}_${listNumber}`
        const label = this.tree.wideProps.metrics.includes(levelKey) ? levelKey : listItem[levelKey]
        const levelType = tree.getNodeLevelType(levelKey)
        this.tree.nodeAttr = {
          originParentKey,
          listNumber,
          levelCount,
          initKey,
          label,
          levelType
        }
        if (!listNumber) {
          this.tree.nodeAttr.samePathNode = null
        } else if (!levelCount) {
          this.tree.nodeAttr.samePathNode = this.tree.wideProps.root
        } else {
          const queue = [this.tree.wideProps.root]
          let currentNode = queue[0]
          while (levelCount !== currentNode.levelCount) {
            queue.push(...currentNode.children)
            currentNode = queue.shift()
          }
          const listItemPath = Object.values(listItem).splice(1, levelCount)
          this.tree.nodeAttr.samePathNode = queue.find((item) => {
            let itemPath = []
            while (item.parent) {
              itemPath.unshift(item.label)
              item = item.parent
            }
            return itemPath.toString() == listItemPath.toString()
          })
        }
        const { samePathNode } = this.tree.nodeAttr
        let key = samePathNode ? samePathNode.key : initKey
        
        const nodeAttr = {
          ...this.tree.nodeAttr,
          label: label,
          key,
          sumType: null,
          originKey: getOriginKey(key),
          parentKey: tree.getParentId(treeNodeGroup),
          sumLastNode: false,
          sumNode: false
        }
        if (nodeAttr.levelType == CategoryType.Metrics) {
          nodeAttr[levelKey] = listItem[levelKey]
        }
        Array.prototype.push.call(
          nodeAttr.levelType == CategoryType.Metrics ? targetNodeGroup : treeNodeGroup,
          nodeAttr
        )
      })
      const levelItemByAttribute = [...treeNodeGroup, targetNodeGroup]
      levelItemByAttribute.forEach((levelItem, index) => {
        while (!Array.isArray(levelItem)) {
          levelItem = [levelItem]
        }
        levelItem.map((item) => {
          tree = tree.getAddToData(item, levelItemByAttribute[index - 1])
        })
      })
    })
  }

  public getFirstNotSum(node) {
    const { subSumText } = this.tree.labelText
    if (!node.sumNode) {
      return node
    }
    if (node.label == subSumText && node.parent.label !== subSumText) {
      return node.parent
    }
    node = node.parent
    return tree.getFirstNotSum(node)
  }

  public getPartBranch(parentNode) {
    const backParent = cloneDeep(parentNode)
    if (backParent.originKey === this.tree.wideProps.rowLast) {
      if (backParent.sumNode) {
        const args = { backParent, parentNode }
        while (
          !this.tree.labelText.rootKey.includes(args.backParent.originKey)
        ) {
          args.backParent = args.backParent.parent
        }
        return tree.getFirstNotSum(parentNode).children
      } else {
        return backParent.parent.children
      }
    }
  }

  public getChildGroup(item) {
    const queue = [item]
    let currentNode = queue.shift()
    while (
      currentNode &&
      currentNode.originKey !== this.tree.wideProps.colArray[0]
    ) {
      queue.push(...currentNode.children)
      currentNode = queue.shift()
    }
    return [...queue, currentNode]
  }

  public decidePolymerizeGroupEmpty(polymerizeGroup, node) {
    return (
      !polymerizeGroup.length ||
      polymerizeGroup.every((item) => item.label !== node.label)
    )
  }

  public getMergePartBranch(parentNode) {
    const polymerizeGroup = []
    tree.getPartBranch(parentNode).forEach((item) => {
      tree.getChildGroup(item).forEach((node) => {
        const metrics = this.tree.wideProps.metrics
        let colBeginNode = new Node(cloneDeep(node), metrics)
        if (tree.decidePolymerizeGroupEmpty(polymerizeGroup, node)) {
          polymerizeGroup.push(colBeginNode)
        } else {
          let origin = polymerizeGroup.find(
            (item) => item.label == colBeginNode.label
          )
          const iteration = (origin, target) => {
            if (!origin && !target) {
              return
            }
            if (origin.label !== target.label) {
              return origin.parent.children.push(target)
            }
            target = target.children[0]
            origin =
              origin.children.find((item) => item.label == target.label) ||
              origin.children[0]
            return iteration(origin, target)
          }
          iteration(origin, colBeginNode)
        }
      })
    })
    return polymerizeGroup
  }

  public copyPolymerizeNormalNode(copyParems, polymerizeGroup) {
    const { deepCopy, isLastSumNode, parentNode, currentNode } = copyParems
    const group = polymerizeGroup || currentNode
    return group.reduce((sumNode, node) => {
      if (parentNode.originKey == this.tree.wideProps.colLast) {
        return sumNode
      } else {
        const polyNormalNode = deepCopy(
          { currentNode: node, parentNode },
          { isLastSumNode: false }
        )
        return sumNode.concat(polyNormalNode)
      }
    }, [])
  }

  public decideSumBranchType(node) {
    const isBeiginNoneParentSumKey = tree.getFirstNotSum(node).originKey

    if (isBeiginNoneParentSumKey === this.tree.labelText.rootKey[0]) {
      return SumType.RowTotal
    } else if (isBeiginNoneParentSumKey === this.tree.wideProps.rowLast) {
      return SumType.ColTotal
    } else if (
      isBeiginNoneParentSumKey !== this.tree.wideProps.rowLast &&
      this.tree.wideProps.rowArray.includes(isBeiginNoneParentSumKey)
    ) {
      return SumType.RowSubTotal
    } else if (this.tree.wideProps.colArray.includes(isBeiginNoneParentSumKey)) {
      return SumType.ColSubTotal
    }
  }

  public getColArrayFirstParent(node) {
    while (node.originKey !== this.tree.wideProps.colArray[0]) {
      node = node.parent
    }
    return node
  }

  public decideSumNodeKeyTextDisplay(options) {
    const { nodeValue, isLastSumNode, indexNumber, currentNode } = options
    if (currentNode.levelType === CategoryType.Col && isLastSumNode) {
      return `${nodeValue}sumLastNode`
    } else {
      return `${nodeValue}${indexNumber}sumNode`
    }
  }

  public decideSumAttribute(options) {
    const {
      newNode,
      key,
      deepCopy,
      parentNode,
      nodeValue,
      isLastSumNode
    } = options
    switch (key) {
      case 'levelCount':
        newNode[key] = parentNode[key] + 1
      case 'parentKey':
        newNode[key] = parentNode.key
        break
      case 'parent':
        newNode[key] = parentNode
        break
      case 'key':
        newNode.key = tree.decideSumNodeKeyTextDisplay(options)
        newNode.originKey = getOriginKey(newNode.key)
        newNode.levelType = tree.getNodeLevelType(newNode.originKey)
        newNode.sumLastNode = !!isSumLastNode(newNode.key)
        newNode.sumNode = isSumNodeEnd(newNode.key)
        break
      case 'label':
        newNode[key] = tree.decideSumOrSubSumTextDisplay(options)
        newNode.sumType = tree.decideSumBranchType(parentNode)
        break
      case 'children':
        newNode[key] = tree.copyIteration(
          deepCopy,
          nodeValue,
          newNode,
          isLastSumNode
        )
        break
      default:
        newNode[key] = null
    }
  }

  public decideSumOrSubSumTextDisplay(options) {
    const { nodeValue, isLastSumNode, parentNode, newNode } = options
    const { subSumText, sumText } = this.tree.labelText
    const isMetricValue = parentNode.originKey == this.tree.wideProps.colLast
    const isParentRowLast = parentNode.originKey == this.tree.wideProps.rowLast

    const isRowSumText =
      !isParentRowLast &&
      [
        ...this.tree.wideProps.rowArray,
        ...this.tree.labelText.rootKey
      ].includes(parentNode.originKey) &&
      [SumType.RowTotal].includes(tree.decideSumBranchType(parentNode))
    const isColSumText =
      !isMetricValue &&
      [...this.tree.wideProps.colArray, this.tree.wideProps.rowLast].includes(
        parentNode.originKey
      ) &&
      [SumType.ColTotal].includes(tree.decideSumBranchType(parentNode))

    const isColStartSumText =
      (!isMetricValue &&
        this.tree.wideProps.colArray.includes(parentNode.originKey) &&
        tree.getColArrayFirstParent(parentNode).sumLastNode) ||
      (isParentRowLast && isLastSumNode && this.tree.wideProps.colArray.length)
    const isSubSumText =
      isLastSumNode && !isQuotaSum(nodeValue, this.tree.wideProps.metricsAgg)
     
    if (isRowSumText || isColSumText || isColStartSumText) {
      return sumText
    } else if (isSubSumText) {
      return subSumText
    } else {
      return nodeValue
    }
  }

  public getMetricNodeSubSumOrSumType(node) {
    const iteration = (node) => {
      if (this.tree.labelText.sumConcat.includes(node.label))
        return node.label
    }
    iteration(node)
  }

  public copyIteration(
    deepCopy,
    currentNode,
    parentNode,
    isLastSumNode = false
  ) {
    return deepCopy({ currentNode, parentNode }, { isLastSumNode })
  }

  public copyPolymerizeNoramlChild(copyParems) {
    const { parentNode, newNode, isLastSumNode } = copyParems
    let polymerizeGroup
    if (
      parentNode.originKey === this.tree.wideProps.rowLast &&
      this.tree.wideProps.colArray.length
    ) {
      polymerizeGroup = tree.getMergePartBranch(parentNode)
    }
    if (
      polymerizeGroup ||
      (!isLastSumNode && parentNode.levelType === CategoryType.Col)
    ) {
      return tree.copyPolymerizeNormalNode(copyParems, polymerizeGroup)
    }
    return newNode
  }

  public copyTotalNode(currentNode, parentNode) {
    let indexNumber = 0
    const deepCopy = (copyNode, copyOptions) => {
      indexNumber++
      const { currentNode, parentNode } = copyNode
      const { isLastSumNode = true } = copyOptions

      if (typeof currentNode !== 'object' || !currentNode) {
        return currentNode
      }
      const metrics = this.tree.wideProps.metrics
      let newNode: any = Array.isArray(currentNode) ? [] : new Node({}, metrics)
      const copyParems = {
        deepCopy,
        ...copyNode,
        ...copyOptions,
        newNode,
        indexNumber,
        isLastSumNode
      }
      if (currentNode.length) {
        newNode = tree.copyPolymerizeNoramlChild(copyParems)
        if (parentNode.originKey === this.tree.wideProps.colLast) {
          currentNode.forEach((k) => {
            const copyNode = tree.copyIteration(deepCopy, k, parentNode, true)
            newNode.push(copyNode)
          })
        } else {
          const copyNode = tree.copyIteration(
            deepCopy,
            currentNode[0],
            parentNode,
            true
          )
          newNode.push(copyNode)
        }
      } else {
        Object.keys(currentNode).forEach((key) => {
          const exitedVal = Array.isArray(newNode[key])
            ? newNode[key].length
            : newNode[key]
          if (exitedVal) {
            return
          }
          const nodeValue = currentNode[key]
          const options = { nodeValue, key, ...copyParems }

          tree.decideSumAttribute(options)
        })
      }
      return newNode
    }
    return tree.copyIteration(deepCopy, currentNode, parentNode, true)
  }

  public getSumMultiwayTree() {
    const queue = [this.tree.wideProps.root]
    let currentNode = queue.shift()
    while (
      currentNode &&
      this.tree.wideProps.rowColConcat.includes(currentNode.originKey)
    ) {
      queue.push(...currentNode.children)
      currentNode.children.push(
        tree.copyTotalNode(currentNode.children[0], currentNode)
      )
      currentNode = queue.shift()
    }
  }

  public getMetricNodeList() {
    const queue = [this.tree.wideProps.root]
    let currentNode = queue.shift()
    queue.push(...currentNode.children)
    while (queue.length) {
      currentNode = queue.shift()
      if (this.tree.wideProps.metrics.includes(currentNode.label)) {
        this.tree.wideProps.metricNodeList.push(currentNode)
      }
      queue.push(...currentNode.children)
    }
  }

  public getUnSumNodeReduceSumMetrics(option) {
      const { children, key, callback } = option
      const colLastNode = children[0].parent.originKey === this.tree.wideProps.colLast
      return children.filter(
        (item) => {
          if(colLastNode){
            return callback(item) && item.originKey === key
          } else {
            return callback(item)
          }
          
        }
      ).reduce((number, node) => {
        return (number = number + node[key])
      }, 0)
  }

  public getSumMetricDFS() {
    this.tree.wideProps.metricNodeList.forEach((node) => {
      if (node.sumNode) {
        const getFirstNonSumParent = (origin, path) => {
          while (origin.sumNode) {
            path.unshift(origin.label)
            origin = origin.parent
          }
          return {
            from: origin,
            path
          }
        }
        const { from, path } = getFirstNonSumParent(node, [])
        this.tree.wideProps.metrics.forEach((key) => {
          const needSum = this.tree.wideProps.metricsTotal[node.originKey].includes(node.sumType)
          if (needSum) {
            tree.matchSameNodeSum(from.children, key, path)
          }
        })
      } else {
        while (node) {
          const callback = (node) => !node.sumNode
          if (this.tree.wideProps.metrics.includes(node.originKey)) {
            node[node.originKey] = node[node.originKey]
          } else {
            this.tree.wideProps.metrics.forEach((key) => {
              const option = {
                children: node.children,
                key,
                callback
              }
              node[key] = tree.getUnSumNodeReduceSumMetrics(
                option
              )
            })
          }
          node = node.parent
        }
        return
      }
    })
  }

  public matchSameNodeSum(currentQueue, key, path) {
    let level = 0
    let needSumNodeGroup = []
    let currentLevelSumNode = currentQueue.find((node) => node.sumNode) 
    while (currentQueue.length) {
      needSumNodeGroup = currentQueue.filter((node) => {
        if (this.tree.labelText.sumConcat.includes(path[level])) {
          return node.label !== path[level]
        } else {
          return node.label == path[level]
        }
      })
      const callback = (node) => !node.sumNode
      const option = {
        children: needSumNodeGroup,
        key,
        callback
      }
      currentLevelSumNode[key] = tree.getUnSumNodeReduceSumMetrics(
        option
      )
      level++
      currentQueue = needSumNodeGroup.reduce((array, item) => {
        return array.concat(item.children)
      }, [])
      currentLevelSumNode = currentLevelSumNode.children.find(
        (item) => item.label === path[level]
      )
    }
  }

  public getTotalWideTableJson() {
    this.tree.wideProps.metricNodeList.forEach((item, count) => {
      const len = this.tree.wideProps.metrics.length
      if (!(count % len)) {
        let obj = {}
        while (item.parent) {
          if(item.levelType === CategoryType.Metrics){
            obj[item.originKey] = item[item.originKey]
          } else {
            obj[item.originKey] = item.label
          }
          item = item.parent
        }
        
        this.tree.wideProps.resultWideList.push(obj)
      } else {
        const resultWideListLast = this.tree.wideProps.resultWideList[
          this.tree.wideProps.resultWideList.length - 1
        ]
        resultWideListLast[item.originKey] = item[item.originKey]
      }
    })
  }

  public getDefaultProps(options) {
    const {
      metrics: { metricsGroup },
      rowGroup,
      colGroup,
      wideTableList,
      metricsAgg
    } = options
    this.tree.wideProps.rowColConcat = [...colGroup, ...rowGroup]
    this.tree.wideProps.rowColConcat.pop()
    this.tree.wideProps.rowColConcat.push(...this.tree.labelText.rootKey)
    this.tree.wideProps.metrics = Object.keys(metricsGroup) || []
    this.tree.wideProps.metricsTotal = metricsGroup
    this.tree.wideProps.metricsAgg = metricsAgg
    this.tree.wideProps.rowArray = colGroup
    this.tree.wideProps.colArray = rowGroup
    this.tree.wideProps.wideTableList = wideTableList
    this.tree.wideProps.root = null
    this.tree.wideProps.metricNodeList = []
    this.tree.wideProps.resultWideList = []
    this.tree.wideProps.rowLast = colGroup[colGroup.length - 1]
    this.tree.wideProps.colLast = rowGroup[rowGroup.length - 1]
  }

  public getTotalWideTableList(options) {
    tree.getDefaultProps(options)
    tree.getMultiwayTree()
    tree.getSumMultiwayTree()
    tree.getMetricNodeList()
    tree.getSumMetricDFS()
    tree.getTotalWideTableJson()
    return tree
  }
}

let tree = new MultiwayTree()

export default tree
