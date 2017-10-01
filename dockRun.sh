#!/bin/sh

TFILE=".chex.built"

if [ -z "$CHEXDBI" ] ; then
    CHEXDBI="mongo"
fi

if [ -z "$CHEXLOCALPORT" ] ; then
    CHEXLOCALPORT=3333
fi

if [ -z "`docker images -q $CHEXDBI`" ] ; then
    echo "Docker image for $CHEXDBI needs to be installed"
    echo "Yes, I could do it, but you may not want me to"
    echo "      docker pull $CHEXDBI && docker run -d $CHEXDBI"
    exit
fi

if [ -z "`docker ps -q -f ancestor=$CHEXDBI`" ] ; then
    echo "Docker image for $CHEXDBI needs to be running"
    echo "Yes, I could do it, but you may not want me to"
    echo "      docker run -d $CHEXDBI"
    exit
fi

if [ ! -z "`netstat -nl | grep $CHEXLOCALPORT`" ] ; then
    echo "Something is already listening on port $CHEXLOCALPORT"
    echo "Stop that process or change the variable CHEXLOCALPORT to another port"
    exit
fi

IMG=`docker ps -q -f ancestor=$CHEXDBI`
DBS=`docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $IMG`

if [ ! -f ${TFILE} ] || [ server.go -nt ${TFILE} ] ; then
    docker build -t chextest .
    touch ${TFILE}
fi
docker run --rm -d -e DBS=$DBS -p ${CHEXLOCALPORT}:3333 chextest
